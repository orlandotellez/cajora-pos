import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import { paypalClient } from "../infrastructure/paypal.client"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type { UpdateSubscriptionInput } from "../domain/subscription.entities"
import {
  SUBSCRIPTION_EVENT_ACTIONS,
  noopSubscriptionEventRepository,
  type ISubscriptionEventRepository,
} from "../domain/subscription-event.interface"

const PAGE_SIZE = 50

interface LogFn {
  (msg: string, ...args: unknown[]): void
  (obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void
}

interface ReconLogger {
  info: LogFn
  warn: LogFn
  error: LogFn
}

interface ReconStats {
  reviewed: number
  drifted: number
  errors: number
  cleaned: number
}

interface PayPalStatusResult {
  status: string
  nextBillingTime: string | null
}

function buildUpdates(
  sub: { status: string; current_period_end: Date | null; cancel_at_period_end: boolean },
  paypal: PayPalStatusResult,
): UpdateSubscriptionInput | null {
  const { status, nextBillingTime } = paypal

  switch (status) {
    case "ACTIVE": {
      const periodMissing =
        !sub.current_period_end || sub.current_period_end.getTime() <= Date.now()
      const statusDrift = sub.status !== "active" || sub.cancel_at_period_end !== false

      if (periodMissing && nextBillingTime) {
        return {
          status: "active",
          current_period_start: new Date(),
          current_period_end: new Date(nextBillingTime),
          cancel_at_period_end: false,
        }
      }
      if (statusDrift) {
        return { status: "active", cancel_at_period_end: false }
      }
      return null
    }

    case "CANCELLED":
      if (sub.status === "canceled" && sub.cancel_at_period_end) return null
      return { status: "canceled", cancel_at_period_end: true }

    case "SUSPENDED":
      return sub.status === "past_due" ? null : { status: "past_due" }

    case "EXPIRED":
      if (sub.status === "expired" && sub.cancel_at_period_end) return null
      return { status: "expired", cancel_at_period_end: true }

    default:
      return null
  }
}

export const createReconciliationService = (
  repository: ISubscriptionRepository,
  eventRepository: ISubscriptionEventRepository = noopSubscriptionEventRepository,
) => ({
  async run(logger: ReconLogger): Promise<ReconStats> {
    const stats: ReconStats = { reviewed: 0, drifted: 0, errors: 0, cleaned: 0 }

    if (!env.PAYPAL_ENABLED) {
      logger.info("Reconciliación omitida: PAYPAL_ENABLED=false (modo mock)")
      return stats
    }

    let skip = 0
    for (; ;) {
      const page = await repository.findPaypalSubscriptions(skip, PAGE_SIZE)
      if (page.length === 0) break

      for (const sub of page) {
        stats.reviewed += 1
        if (!sub.paypal_subscription_id) continue

        try {
          const paypal = await paypalClient.getSubscription(sub.paypal_subscription_id)
          const updates = buildUpdates(sub, paypal)
          if (updates) {
            await repository.update(sub.store_id, updates)
            stats.drifted += 1
            logger.info(
              { storeId: sub.store_id, paypalStatus: paypal.status },
              "Suscripción realineada con PayPal: %s",
              String(sub.paypal_subscription_id),
            )
          }
        } catch (err) {
          const isOrphan = err instanceof AppError && err.statusCode === 404
          if (isOrphan && sub.status !== "active") {
            await repository.update(sub.store_id, { paypal_subscription_id: null })
            await eventRepository.create({
              store_id: sub.store_id,
              user_id: null,
              action: SUBSCRIPTION_EVENT_ACTIONS.ORPHAN_CLEANED,
              paypal_subscription_id: sub.paypal_subscription_id,
              metadata: { reason: "paypal_404", status_local: sub.status },
            })
            stats.cleaned += 1
            logger.warn(
              { storeId: sub.store_id, paypalId: sub.paypal_subscription_id, statusLocal: sub.status },
              "Suscripción huérfana en PayPal (404) — id desvinculado de la DB",
            )
          } else {
            stats.errors += 1
            logger.warn(
              { err, storeId: sub.store_id, paypalId: sub.paypal_subscription_id },
              "Error reconciliando suscripción con PayPal",
            )
          }
        }
      }

      skip += page.length
    }

    logger.info({ ...stats }, "Reconciliación completada")
    return stats
  },
})
