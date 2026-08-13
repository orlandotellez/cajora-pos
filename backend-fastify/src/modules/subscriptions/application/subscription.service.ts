import { env } from "@/config/env"
import { ConflictError } from "@/core/errors/AppError"
import { paypalClient } from "../infrastructure/paypal.client"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type { ISubscriptionEntity } from "../domain/subscription.entities"
import type { ISubscriptionResponse } from "../domain/subscription.types"

const TRIAL_DAYS = 14 // trial sin tarjeta (D0.2) — la tarjeta se pide al suscribirse
const PERIOD_DAYS = 30 // duración del período mensual tras activar

function mapToResponse(sub: ISubscriptionEntity): ISubscriptionResponse {
  return {
    mode: sub.mode,
    plan: sub.plan,
    status: sub.status,
    paypal_subscription_id: sub.paypal_subscription_id,
    current_period_start: sub.current_period_start?.toISOString() ?? null,
    current_period_end: sub.current_period_end?.toISOString() ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_ends_at: sub.trial_ends_at?.toISOString() ?? null,
  }
}

/** Crea/restablece la fila cloud en estado trial (14 días, sin PayPal). */
function startTrial(
  repository: ISubscriptionRepository,
  storeId: string,
): Promise<ISubscriptionEntity> {
  return repository.upsertCloud(storeId, {
    mode: "cloud",
    plan: "monthly",
    status: "trial",
    trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
  })
}

export const createSubscriptionService = (repository: ISubscriptionRepository) => ({
  /** Elige modo Cloud e inicia el trial de 14 días. Sin PayPal ni tarjeta durante el trial. */
  async elegirCloud(storeId: string): Promise<ISubscriptionResponse> {
    const existing = await repository.getByStoreId(storeId)
    // Si ya hay una suscripción PayPal, no resetear el estado (evita degradar a una tienda que paga)
    if (existing?.paypal_subscription_id) {
      return mapToResponse(existing)
    }
    return mapToResponse(await startTrial(repository, storeId))
  },

  /**
   * Crea la suscripción en PayPal — aquí es donde PayPal pide la tarjeta.
   * Se llama al suscribirse (fin del trial o antes). El webhook ACTIVATED es la fuente de verdad.
   */
  async checkout(storeId: string, returnUrl: string, cancelUrl: string) {
    const planId = env.PAYPAL_PLAN_ID_MONTHLY
    const created = await paypalClient.createSubscription(planId, returnUrl, cancelUrl)

    // Si una tienda self_hosted va directo a checkout, asegura la fila cloud (trial)
    const existing = await repository.getByStoreId(storeId)
    if (!existing) {
      await startTrial(repository, storeId)
    }
    await repository.update(storeId, { paypal_subscription_id: created.id })

    return {
      paypalSubscriptionId: created.id,
      approvalUrl: created.approvalUrl,
    }
  },

  /** Activa tras el onApprove del frontend (UX instantánea; el webhook la confirma). Idempotente. */
  async activate(storeId: string, paypalSubscriptionId: string): Promise<ISubscriptionResponse> {
    const sub = await repository.getByStoreId(storeId)
    if (!sub || sub.paypal_subscription_id !== paypalSubscriptionId) {
      throw new ConflictError("La suscripción no pertenece a esta tienda")
    }

    const now = new Date()
    const updated = await repository.update(storeId, {
      status: "active",
      current_period_start: now,
      current_period_end: new Date(now.getTime() + PERIOD_DAYS * 86_400_000),
      trial_ends_at: null,
    })
    if (!updated) throw new ConflictError("No hay suscripción activa")
    return mapToResponse(updated)
  },

  /**
   * Baja self-serve: cancela en PayPal (efecto al FIN del período pagado).
   * La tienda sigue activa hasta que el webhook BILLING.SUBSCRIPTION.CANCELLED (T1.7.3)
   * confirme el corte — no bloquear a quien ya pagó el mes.
   */
  async cancel(storeId: string): Promise<ISubscriptionResponse> {
    const sub = await repository.getByStoreId(storeId)
    if (!sub?.paypal_subscription_id) {
      throw new ConflictError("No hay suscripción activa")
    }

    await paypalClient.cancelSubscription(sub.paypal_subscription_id)
    const updated = await repository.update(storeId, {
      cancel_at_period_end: true,
    })
    if (!updated) throw new ConflictError("No hay suscripción activa")
    return mapToResponse(updated)
  },

  /** Reactiva: PayPal no reactiva subs canceladas → reabre el flujo (estado trial). */
  async reactivate(storeId: string): Promise<ISubscriptionResponse> {
    const existing = await repository.getByStoreId(storeId)
    if (!existing) {
      return mapToResponse(await startTrial(repository, storeId))
    }
    // Ya activa → no-op idempotente
    if (existing.status === "active") {
      return mapToResponse(existing)
    }
    const updated = await repository.update(storeId, {
      status: "trial",
      cancel_at_period_end: false,
    })
    if (!updated) throw new ConflictError("No hay suscripción activa")
    return mapToResponse(updated)
  },

  /** Estado actual; sin fila → self_hosted activo (gratis, sin gateo). */
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
        trial_ends_at: null,
      }
    }
    return mapToResponse(sub)
  },
})
