import { Prisma } from "@prisma/client"
import type { paypal_webhook_event } from "@prisma/client"
import type { FastifyReply, FastifyRequest } from "fastify"
import { prisma } from "@/config/prisma"
import { verifyPayPalWebhook } from "../infrastructure/paypal.webhook-verifier"
import { SubscriptionRepository } from "../infrastructure/subscription.prisma.repository"
import { PayPalWebhookEventRepository } from "../infrastructure/paypal-webhook-event.prisma.repository"
import { SubscriptionEventRepository } from "../infrastructure/subscription-event.prisma.repository"
import { SUBSCRIPTION_EVENT_ACTIONS } from "../domain/subscription-event.interface"
import type { SubscriptionEventAction } from "../domain/subscription-event.interface"
import type { UpdateSubscriptionInput } from "../domain/subscription.entities"
import { NotificationRepository } from "@/modules/notifications/infrastructure/notification.prisma.repository"
import { createNotificationService } from "@/modules/notifications/application/notification.service"

const notificationService = createNotificationService(NotificationRepository)
const PERIOD_DAYS = 30

const STATUS_LABELS: Record<string, string> = {
  past_due: "Pago fallido",
  canceled: "Cancelada",
  expired: "Expirada",
}

const EVENT_LABELS: Record<string, string> = {
  webhook_payment_failed: "El pago de tu suscripción falló. Por favor, actualiza tu método de pago.",
  webhook_suspended: "Tu suscripción ha sido suspendida por falta de pago.",
  webhook_cancelled: "Tu suscripción ha sido cancelada.",
  webhook_expired: "Tu suscripción ha expirado.",
}

async function createSubscriptionNotification(
  log: FastifyRequest["log"],
  storeId: string,
  action: string,
  status: string,
): Promise<void> {
  try {
    // Find the store owner
    const owner = await prisma.user.findFirst({
      where: { store_id: storeId, is_owner: true, deleted_at: null },
      select: { id: true },
    })
    if (!owner) return

    const statusLabel = STATUS_LABELS[status] ?? status
    const detail = EVENT_LABELS[action] ?? `Estado de suscripción cambiado a: ${statusLabel}`

    await notificationService.create({
      user_id: owner.id,
      store_id: storeId,
      type: action === "webhook_cancelled" ? "subscription_canceled"
        : action === "webhook_expired" ? "subscription_expired"
        : "payment_failed",
      title: `Suscripción: ${statusLabel}`,
      message: detail,
      metadata: { action, status },
    })
  } catch (err) {
    log.warn({ err, storeId }, "No se pudo crear notificación de suscripción")
  }
}

interface PayPalWebhookPayload {
  id?: string
  event_type?: string
  resource_type?: string
  resource?: {
    id?: string
    resource_type?: string
    billing_agreement_id?: string
  }
}

function subscriptionIdFromEvent(event: PayPalWebhookPayload): string | null {
  const resource = event.resource
  if (!resource) return null
  if (event.event_type?.startsWith("PAYMENT.SALE.")) {
    return resource.billing_agreement_id ?? resource.id ?? null
  }
  return resource.id ?? null
}

function getRawBody(request: FastifyRequest): string {
  const body = request.body
  if (typeof body === "string") return body
  return JSON.stringify(body ?? {})
}

async function applyByResource(
  log: FastifyRequest["log"],
  ev: paypal_webhook_event,
  data: UpdateSubscriptionInput,
  action: SubscriptionEventAction,
): Promise<void> {
  const resourceId = ev.resource_id
  if (!resourceId) return
  const sub = await SubscriptionRepository.getByPaypalSubscriptionId(resourceId)
  if (!sub) {
    log.warn({ resourceId }, "Evento PayPal no matchea ninguna suscripción local.")
    return
  }
  await SubscriptionRepository.update(sub.store_id, data)
  // Auditoría: quién (sistema) y qué evento de PayPal cambió el estado local.
  await SubscriptionEventRepository.create({
    store_id: sub.store_id,
    user_id: null,
    action,
    paypal_subscription_id: sub.paypal_subscription_id ?? resourceId,
    metadata: { event_type: ev.event_type, event_id: ev.event_id },
  })
}

export const webhookController = {
  receive: async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = getRawBody(request)

    if (!(await verifyPayPalWebhook(request.headers, rawBody))) {
      request.log.warn("PayPal webhook signature verification failed; ignoring payload.")
      return reply.status(200).send({ received: true })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch (err) {
      request.log.error({ err }, "PayPal webhook body was not parseable JSON.")
      return reply.status(400).send({ error: "invalid json" })
    }
    const event = parsed as PayPalWebhookPayload
    const eventId = event.id ?? ""
    const eventType = event.event_type ?? ""

    let outbox: paypal_webhook_event
    try {
      outbox = await PayPalWebhookEventRepository.insert({
        event_id: eventId,
        event_type: eventType,
        resource_type: event.resource_type ?? event.resource?.resource_type ?? null,
        resource_id: subscriptionIdFromEvent(event),
        payload: parsed as Prisma.InputJsonValue,
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        request.log.info({ eventId }, "Webhook duplicado — ya procesado.")
        return reply.status(200).send({ received: true })
      }
      throw err
    }

    try {
      await dispatch(request, outbox)
      await PayPalWebhookEventRepository.markProcessed(outbox.id, `dispatched:${outbox.event_type}`)
    } catch (err) {
      request.log.error({ err, eventId }, "Dispatch falló — se deja sin procesar para reintento.")
      return reply.status(500).send({ error: "dispatch failed" })
    }

    return reply.status(200).send({ received: true })
  },
}

async function dispatch(request: FastifyRequest, ev: paypal_webhook_event): Promise<void> {
  const { log } = request

  switch (ev.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      // SALE.COMPLETED: si el end ya está seteado (SALE llegó antes), no lo pisa.
      if (!ev.resource_id) break
      const sub = await SubscriptionRepository.getByPaypalSubscriptionId(ev.resource_id)
      if (!sub) break
      const now = new Date()
      await SubscriptionRepository.update(sub.store_id, {
        status: "active",
        current_period_start: now,
        ...(sub.current_period_end
          ? {}
          : { current_period_end: new Date(now.getTime() + PERIOD_DAYS * 86_400_000) }),
      })
      await SubscriptionEventRepository.create({
        store_id: sub.store_id,
        user_id: null,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_ACTIVATED,
        paypal_subscription_id: sub.paypal_subscription_id ?? ev.resource_id,
        metadata: { event_type: ev.event_type, event_id: ev.event_id },
      })
      break
    }

    case "PAYMENT.SALE.COMPLETED": {
      // Renovación mensual cobrada: extiende el período +30 días
      const now = new Date()
      await applyByResource(log, ev, {
        status: "active",
        current_period_start: now,
        current_period_end: new Date(now.getTime() + PERIOD_DAYS * 86_400_000),
        cancel_at_period_end: false,
      }, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_SALE_COMPLETED)
      break
    }

    case "BILLING.SUBSCRIPTION.CANCELLED": {
      // PayPal confirmó el corte al fin del período
      const cancelResourceId = ev.resource_id
      await applyByResource(log, ev, {
        status: "canceled",
        cancel_at_period_end: true,
      }, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_CANCELLED)
      // Notificar al owner
      if (cancelResourceId) {
        const cancelSub = await SubscriptionRepository.getByPaypalSubscriptionId(cancelResourceId)
        if (cancelSub) await createSubscriptionNotification(log, cancelSub.store_id, "webhook_cancelled", "canceled")
      }
      break
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      // Pago fallido → entra el grace period del licenseGuard
      const suspResourceId = ev.resource_id
      await applyByResource(log, ev, { status: "past_due" }, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_SUSPENDED)
      if (suspResourceId) {
        const suspSub = await SubscriptionRepository.getByPaypalSubscriptionId(suspResourceId)
        if (suspSub) await createSubscriptionNotification(log, suspSub.store_id, "webhook_suspended", "past_due")
      }
      break
    }

    case "PAYMENT.SALE.PAYMENT.FAILED": {
      const failResourceId = subscriptionIdFromEvent(ev as unknown as PayPalWebhookPayload)
      await applyByResource(log, ev, { status: "past_due" }, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_PAYMENT_FAILED)
      if (failResourceId) {
        const failSub = await SubscriptionRepository.getByPaypalSubscriptionId(failResourceId)
        if (failSub) await createSubscriptionNotification(log, failSub.store_id, "webhook_payment_failed", "past_due")
      }
      break
    }

    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const expResourceId = ev.resource_id
      await applyByResource(log, ev, {
        status: "expired",
        cancel_at_period_end: true,
      }, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_EXPIRED)
      if (expResourceId) {
        const expSub = await SubscriptionRepository.getByPaypalSubscriptionId(expResourceId)
        if (expSub) await createSubscriptionNotification(log, expSub.store_id, "webhook_expired", "expired")
      }
      break
    }

    default:
      log.info({ eventType: ev.event_type }, "Evento PayPal no manejado (ignorado).")
      break
  }
}
