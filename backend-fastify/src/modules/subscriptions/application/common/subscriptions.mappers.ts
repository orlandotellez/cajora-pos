import type { ISubscriptionEntity } from "../../domain/subscription.entities"
import { resolveEntitlement } from "../../domain/subscription.entitlement"
import type { ISubscriptionResponse } from "../../domain/subscription.types"

/**
 * Mapea la fila a la respuesta de la API con el estado ya resuelto contra el reloj.
 * El `status` guardado dice lo último que reportó PayPal; el que sale en la respuesta
 * es lo que se cobra hoy, así la UI nunca muestra "Activa" con un período vencido.
 */
export function mapToResponse(sub: ISubscriptionEntity, now: Date = new Date()): ISubscriptionResponse {
  const { state, graceEndsAt, daysOverdue } = resolveEntitlement(sub, now)

  return {
    mode: sub.mode,
    plan: sub.plan,
    status: state,
    paypal_subscription_id: sub.paypal_subscription_id,
    current_period_start: sub.current_period_start?.toISOString() ?? null,
    current_period_end: sub.current_period_end?.toISOString() ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
    grace_ends_at: graceEndsAt?.toISOString() ?? null,
    days_overdue: daysOverdue,
  }
}