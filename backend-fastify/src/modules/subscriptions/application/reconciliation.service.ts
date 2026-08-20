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
  paymentsBackfilled: number
}

interface PayPalStatusResult {
  status: string
  nextBillingTime: string | null
}

const BACKFILL_WINDOW_BUFFER_MS = 2 * 86_400_000

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

async function backfillPayments(
  logger: ReconLogger,
  sub: { store_id: string; paypal_subscription_id: string | null; current_period_start: Date | null },
  eventRepository: ISubscriptionEventRepository,
  client: typeof paypalClient,
  stats: ReconStats,
): Promise<void> {
  if (!sub.paypal_subscription_id || !sub.current_period_start) return

  const fromISO = new Date(sub.current_period_start.getTime() - BACKFILL_WINDOW_BUFFER_MS).toISOString()
  const toISO = new Date().toISOString()

  const transactions = await client.getTransactions(sub.paypal_subscription_id, fromISO, toISO)

  for (const tx of transactions) {
    if (tx.status !== "COMPLETED" || !tx.time) continue
    const periodStart = new Date(tx.time)
    const inserted = await eventRepository.createIdempotent({
      store_id: sub.store_id,
      user_id: null,
      action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_SALE_COMPLETED,
      paypal_subscription_id: sub.paypal_subscription_id,
      metadata: {
        source: "reconciliation",
        transaction_id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
      },
      period_start: periodStart,
      created_at: periodStart,
    })
    if (inserted) {
      stats.paymentsBackfilled += 1
      logger.info(
        { storeId: sub.store_id, transactionId: tx.id, amount: tx.amount },
        "Cobro faltante rellenado desde transacciones de PayPal",
      )
    }
  }
}

export const createReconciliationService = (
  repository: ISubscriptionRepository,
  eventRepository: ISubscriptionEventRepository = noopSubscriptionEventRepository,
) => ({
  async run(logger: ReconLogger): Promise<ReconStats> {
    const stats: ReconStats = { reviewed: 0, drifted: 0, errors: 0, cleaned: 0, paymentsBackfilled: 0 }

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

          if (sub.status === "active" || sub.current_period_start) {
            await backfillPayments(logger, sub, eventRepository, paypalClient, stats)
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
