import { env } from "@/config/env"
import { ConflictError } from "@/core/errors/AppError"
import { paypalClient } from "../infrastructure/paypal.client"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type { ISubscriptionEntity } from "../domain/subscription.entities"
import type { IBillingResponse, ISubscriptionResponse } from "../domain/subscription.types"
import type { IPayPalWebhookEventRepository } from "../domain/paypal-webhook-event.interface"
import {
  SUBSCRIPTION_EVENT_ACTIONS,
  noopSubscriptionEventRepository,
  type ISubscriptionEventRepository,
  type SubscriptionActor,
} from "../domain/subscription-event.interface"

const PERIOD_DAYS = 30
const PLAN_PRICE = "15.99"
const PLAN_CURRENCY = "USD"

function mapToResponse(sub: ISubscriptionEntity): ISubscriptionResponse {
  return {
    mode: sub.mode,
    plan: sub.plan,
    status: sub.status,
    paypal_subscription_id: sub.paypal_subscription_id,
    current_period_start: sub.current_period_start?.toISOString() ?? null,
    current_period_end: sub.current_period_end?.toISOString() ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
  }
}

function noopActor(): SubscriptionActor {
  return { userId: null, ip: null, userAgent: null }
}

function extractSaleAmount(payload: unknown): { amount: string; currency: string } {
  const p = (payload ?? {}) as {
    resource?: { amount?: { total?: unknown; currency?: unknown } }
  }
  const total = p.resource?.amount?.total
  const currency = p.resource?.amount?.currency
  return {
    amount: typeof total === "string" && total.trim() ? total : PLAN_PRICE,
    currency: typeof currency === "string" && currency.trim() ? currency : PLAN_CURRENCY,
  }
}

export const createSubscriptionService = (
  repository: ISubscriptionRepository,
  eventRepository: ISubscriptionEventRepository = noopSubscriptionEventRepository,
  webhookEventRepository?: IPayPalWebhookEventRepository,
) => {
  /** Registra en la auditoría una acción disparada por un usuario. */
  const audit = async (
    actor: SubscriptionActor,
    storeId: string,
    action: (typeof SUBSCRIPTION_EVENT_ACTIONS)[keyof typeof SUBSCRIPTION_EVENT_ACTIONS],
    paypalSubscriptionId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> => {
    await eventRepository.create({
      store_id: storeId,
      user_id: actor.userId,
      action,
      paypal_subscription_id: paypalSubscriptionId ?? null,
      metadata: { ip: actor.ip, userAgent: actor.userAgent, ...metadata },
    })
  }

  return {
    async checkout(
      storeId: string,
      returnUrl: string,
      cancelUrl: string,
      actor: SubscriptionActor = noopActor(),
    ) {
      const planId = env.PAYPAL_PLAN_ID_MONTHLY
      const created = await paypalClient.createSubscription(planId, returnUrl, cancelUrl)

      const existing = await repository.getByStoreId(storeId)
      if (!existing) {
        // La fila debe existir con el paypal_subscription_id ANTES de que PayPal
        // complete el pago: el webhook la busca por ese id.
        await repository.upsertCloud(storeId, {
          mode: "cloud",
          plan: "monthly",
          status: "pending",
          paypal_subscription_id: created.id,
        })
      } else {
        await repository.update(storeId, { paypal_subscription_id: created.id })
      }
      await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.CHECKOUT, created.id)

      return {
        paypalSubscriptionId: created.id,
        approvalUrl: created.approvalUrl,
      }
    },

    async activate(
      storeId: string,
      paypalSubscriptionId: string,
      actor: SubscriptionActor = noopActor(),
    ): Promise<ISubscriptionResponse> {
      const sub = await repository.getByStoreId(storeId)
      if (!sub || sub.paypal_subscription_id !== paypalSubscriptionId) {
        throw new ConflictError("La suscripción no pertenece a esta tienda")
      }

      const now = new Date()

      const alreadyActive =
        sub.status === "active" &&
        sub.current_period_start !== null &&
        sub.current_period_end !== null &&
        sub.current_period_start.getTime() <= now.getTime() &&
        now.getTime() < sub.current_period_end.getTime()
      if (alreadyActive) {
        await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.ACTIVATE, paypalSubscriptionId)
        return mapToResponse(sub)
      }

      const updated = await repository.update(storeId, {
        status: "active",
        current_period_start: now,
        current_period_end: new Date(now.getTime() + PERIOD_DAYS * 86_400_000),
      })
      if (!updated) throw new ConflictError("No hay suscripción activa")

      await eventRepository.createIdempotent({
        store_id: storeId,
        user_id: actor.userId,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_SALE_COMPLETED,
        paypal_subscription_id: paypalSubscriptionId,
        metadata: { source: "app_activate", period_start: now.toISOString() },
        period_start: now,
        created_at: now,
      })

      await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.ACTIVATE, paypalSubscriptionId)
      return mapToResponse(updated)
    },

    async cancel(storeId: string, actor: SubscriptionActor = noopActor()): Promise<ISubscriptionResponse> {
      const sub = await repository.getByStoreId(storeId)
      if (!sub?.paypal_subscription_id) {
        throw new ConflictError("No hay suscripción activa")
      }

      await paypalClient.cancelSubscription(sub.paypal_subscription_id)
      const updated = await repository.update(storeId, {
        cancel_at_period_end: true,
      })
      if (!updated) throw new ConflictError("No hay suscripción activa")
      await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.CANCEL, sub.paypal_subscription_id)
      return mapToResponse(updated)
    },

    async reactivate(storeId: string, actor: SubscriptionActor = noopActor()): Promise<ISubscriptionResponse> {
      const existing = await repository.getByStoreId(storeId)
      if (!existing) {
        const sub = await repository.upsertCloud(storeId, {
          mode: "cloud",
          plan: "monthly",
          status: "pending",
        })
        await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.REACTIVATE)
        return mapToResponse(sub)
      }
      if (existing.status === "active" && existing.cancel_at_period_end) {
        const updated = await repository.update(storeId, {
          cancel_at_period_end: false,
        })
        if (!updated) throw new ConflictError("No hay suscripción activa")
        await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.REACTIVATE, existing.paypal_subscription_id)
        return mapToResponse(updated)
      }
      if (existing.status === "active") {
        return mapToResponse(existing)
      }
      const updated = await repository.update(storeId, {
        status: "pending",
        cancel_at_period_end: false,
      })
      if (!updated) throw new ConflictError("No hay suscripción activa")
      await audit(actor, storeId, SUBSCRIPTION_EVENT_ACTIONS.REACTIVATE, existing.paypal_subscription_id)
      return mapToResponse(updated)
    },

    async getByStore(storeId: string): Promise<ISubscriptionResponse> {
      const sub = await repository.getByStoreId(storeId)
      if (!sub) {
        return {
          mode: "self_hosted",
          plan: "monthly",
          status: "active",
          paypal_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
        }
      }
      return mapToResponse(sub)
    },

    async getBilling(storeId: string): Promise<IBillingResponse> {
      const events = await eventRepository.findMany({
        store_id: storeId,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_SALE_COMPLETED,
        limit: 200,
        offset: 0,
      })

      const eventIds = events
        .map((e) => (e.metadata as { event_id?: unknown } | null)?.event_id)
        .filter((v): v is string => typeof v === "string")

      let amounts = new Map<string, { amount: string; currency: string }>()
      if (webhookEventRepository && eventIds.length > 0) {
        const outbox = await webhookEventRepository.findByEventIds(eventIds)
        amounts = new Map(outbox.map((o) => [o.event_id, extractSaleAmount(o.payload)]))
      }

      const payments = events.map((e) => {
        const meta = (e.metadata as { event_id?: string; amount?: string; currency?: string } | null) ?? {}

        let amount: string
        let currency: string

        const fromOutbox = amounts.get(meta.event_id ?? "")
        if (fromOutbox) {
          // Monto real del payload del webhook de PayPal.
          amount = fromOutbox.amount
          currency = fromOutbox.currency
        } else if (typeof meta.amount === "string" && meta.amount.trim()) {
          // Evento registrado por la app (activate / reconciliación) con monto propio.
          amount = meta.amount
          currency = typeof meta.currency === "string" && meta.currency.trim() ? meta.currency : PLAN_CURRENCY
        } else {
          // Último recurso: precio del plan.
          amount = PLAN_PRICE
          currency = PLAN_CURRENCY
        }

        return {
          id: e.id,
          amount,
          currency,
          paid_at: e.created_at.toISOString(),
        }
      })

      let total = 0
      for (const p of payments) total += Number(p.amount) || 0

      const sub = await repository.getByStoreId(storeId)
      const nextPaymentAt =
        sub && (sub.status === "active" || sub.status === "past_due") && sub.current_period_end
          ? sub.current_period_end.toISOString()
          : null

      return {
        payments,
        total_paid: total.toFixed(2),
        currency: payments[0]?.currency ?? PLAN_CURRENCY,
        next_payment_at: nextPaymentAt,
      }
    },
  }
}
