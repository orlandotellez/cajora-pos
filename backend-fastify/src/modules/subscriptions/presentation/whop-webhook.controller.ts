import { Prisma } from "@/generated/prisma/client"
import type { whop_webhook_event } from "@/generated/prisma/client"
import type { FastifyReply, FastifyRequest } from "fastify"
import { AppError } from "@/core/errors/AppError"
import { verifyWhopWebhook } from "../infrastructure/whop.webhook-verifier"
import { whopClient } from "../infrastructure/whop.client"
import type { WhopMembership } from "../domain/whop-membership"
import { SubscriptionRepository } from "../infrastructure/subscription.prisma.repository"
import { WhopWebhookEventRepository } from "../infrastructure/whop-webhook-event.prisma.repository"
import { SubscriptionEventRepository } from "../infrastructure/subscription-event.prisma.repository"
import type { SubscriptionEventAction } from "../domain/subscription-event.interface"
import type { ISubscriptionEntity } from "../domain/subscription.entities"
import { verifyCheckoutRef } from "../domain/whop-checkout-ref"
import { buildMembershipUpdate, translateWhopStatus } from "../domain/whop-membership-sync"

/** Envelope estándar de los webhooks de Whop. */
interface WhopWebhookData {
  id?: string
  membership_id?: string
}

interface WhopWebhookPayload {
  id?: string
  type?: string
  data?: WhopWebhookData
}

/** Igual que en el webhook de PayPal: el body crudo es lo que se firma. */
function getRawBody(request: FastifyRequest): string {
  const body = request.body
  if (typeof body === "string") return body
  return JSON.stringify(body ?? {})
}

/**
 * Whop no manda el id de la membership en el mismo campo para todos los eventos:
 * `membership.*` lo trae en `data.id` y `payment.*` en `data.membership_id`.
 */
function membershipIdFromPayload(event: WhopWebhookPayload): string | null {
  const type = event.type ?? ""
  const data = event.data
  if (!data) return null
  if (type.startsWith("membership.")) return data.id ?? null
  if (type.startsWith("payment.")) return data.membership_id ?? null
  return null
}

/**
 * Auditoría no fatal: un fallo al auditar no debe convertir un update ya aplicado
 * en un 500 que le haga reintentar a Whop un trabajo que ya está hecho.
 */
async function auditMembershipEvent(
  log: FastifyRequest["log"],
  ev: whop_webhook_event,
  sub: ISubscriptionEntity,
  action: SubscriptionEventAction,
  whopStatus: string,
): Promise<void> {
  try {
    await SubscriptionEventRepository.create({
      store_id: sub.store_id,
      user_id: null,
      action,
      paypal_subscription_id: null,
      metadata: { event_type: ev.event_type, event_id: ev.event_id, whop_status: whopStatus },
    })
  } catch (err) {
    log.warn({ err, eventId: ev.event_id }, "No se pudo auditar el evento de Whop.")
  }
}

/**
 * Resuelve la tienda desde `metadata.ref`. Whop copia el metadata del checkout a la
 * membership, así que la primera compra se vincula sin mandar nunca el `store_id`
 * crudo: la firma de la referencia es lo que impide apuntar a la tienda ajena.
 */
function storeIdFromCheckoutRef(membership: WhopMembership): string | null {
  const ref = membership.metadata?.ref
  if (typeof ref !== "string" || !ref) return null
  return verifyCheckoutRef(ref)
}

/**
 * Aplica el estado real de Whop a una fila local: traduce el estado, resuelve el
 * período y audita. Es el paso compartido entre la fila ya vinculada y la primera
 * compra (que además escribe el vínculo), para no duplicar la tabla de estados.
 */
async function applyMembershipState(
  log: FastifyRequest["log"],
  ev: whop_webhook_event,
  sub: ISubscriptionEntity,
  membership: WhopMembership,
  link = false,
): Promise<void> {
  const translated = translateWhopStatus(membership)
  if (!translated) {
    log.info({ whopStatus: membership.status }, "Estado de Whop sin cambio local (ignorado).")
    return
  }

  // La tabla de estados y las reglas de período viven en `domain/whop-membership-sync`
  // para que el webhook y la reconciliación no puedan divergir.
  const update = buildMembershipUpdate(membership, sub, new Date())
  const linkFields = link ? { provider: "whop" as const, whop_membership_id: membership.id } : {}

  if (update) {
    // Primera compra: el vínculo se escribe en la misma operación que el estado, así
    // no queda una fila vinculada sin estado ni al revés. `paypal_subscription_id`
    // no se toca: el id histórico del otro proveedor sobrevive.
    await SubscriptionRepository.update(sub.store_id, { ...update, ...linkFields })
  } else if (link) {
    // La fila ya coincidía pero todavía no estaba vinculada: se adopta igual.
    await SubscriptionRepository.update(sub.store_id, linkFields)
  }

  await auditMembershipEvent(log, ev, sub, translated.action, membership.status)
}

/**
 * El evento dispara, la API decide: Whop no garantiza orden ni entrega única, así
 * que `data.status` nunca se cree y el estado real siempre se relee de la API.
 */
async function dispatch(request: FastifyRequest, ev: whop_webhook_event): Promise<void> {
  const { log } = request
  const event = ev.payload as unknown as WhopWebhookPayload

  const membershipId = membershipIdFromPayload(event)
  if (!membershipId) {
    // Eventos que no son de membership/payment, o payload incompleto: se ignoran.
    log.info({ eventType: ev.event_type }, "Webhook de Whop sin id de membership (ignorado).")
    return
  }

  let membership: WhopMembership
  try {
    membership = await whopClient.getMembership(membershipId)
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      // La membership desapareció en Whop: desvincular la huérfana es de T5, no de aquí.
      log.warn({ membershipId }, "La membership no existe en Whop; se ignora el evento.")
      return
    }
    // Fallo real: se propaga para que el wrapper devuelva 500 y Whop reintente.
    throw err
  }

  const byMembership = await SubscriptionRepository.getByWhopMembershipId(membership.id)
  let sub: ISubscriptionEntity
  let firstPurchase = false
  if (byMembership) {
    sub = byMembership
  } else {
    // Primera compra: todavía no hay fila con `whop_membership_id`. El puente es la
    // referencia firmada que el checkout mandó como `metadata.ref`.
    const storeId = storeIdFromCheckoutRef(membership)
    if (!storeId) {
      log.warn(
        { membershipId: membership.id },
        "Evento Whop sin suscripción local ni referencia de checkout válida.",
      )
      return
    }
    const byStore = await SubscriptionRepository.getByStoreId(storeId)
    if (!byStore) {
      // La referencia es válida pero la tienda no tiene fila: no se inventa una.
      log.warn({ storeId }, "La referencia de checkout no matchea ninguna suscripción local.")
      return
    }
    sub = byStore
    firstPurchase = true
  }

  await applyMembershipState(log, ev, sub, membership, firstPurchase)
}

export const whopWebhookController = {
  receive: async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = getRawBody(request)

    // Firma inválida: se responde 200 para no revelar por qué se descartó.
    if (!(await verifyWhopWebhook(request.headers, rawBody))) {
      request.log.warn("Verificación de firma del webhook de Whop falló; se ignora el payload.")
      return reply.status(200).send({ received: true })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch (err) {
      request.log.error({ err }, "El body del webhook de Whop no es JSON parseable.")
      return reply.status(400).send({ error: "invalid json" })
    }

    const event = parsed as WhopWebhookPayload
    // `webhook-id` es la clave de idempotencia de Standard Webhooks.
    const headerEventId = request.headers["webhook-id"]
    const eventId = (Array.isArray(headerEventId) ? headerEventId[0] : headerEventId) ?? event.id ?? ""
    const eventType = event.type ?? ""

    let outbox: whop_webhook_event
    try {
      outbox = await WhopWebhookEventRepository.insert({
        event_id: eventId,
        event_type: eventType,
        resource_id: membershipIdFromPayload(event),
        payload: parsed as Prisma.InputJsonValue,
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        request.log.info({ eventId }, "Webhook de Whop duplicado — ya procesado.")
        return reply.status(200).send({ received: true })
      }
      throw err
    }

    try {
      await dispatch(request, outbox)
      await WhopWebhookEventRepository.markProcessed(outbox.id, `dispatched:${outbox.event_type}`)
    } catch (err) {
      request.log.error({ err, eventId }, "Dispatch de Whop falló — se deja sin procesar para reintento.")
      return reply.status(500).send({ error: "dispatch failed" })
    }

    return reply.status(200).send({ received: true })
  },
}
