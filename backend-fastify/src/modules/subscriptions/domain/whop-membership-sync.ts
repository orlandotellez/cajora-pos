import type { WhopMembership } from "./whop-membership"
import type { ISubscriptionEntity, UpdateSubscriptionInput } from "./subscription.entities"
import type { SubscriptionStatus } from "./subscription.types"
import type { SubscriptionEventAction } from "./subscription-event.interface"
import { SUBSCRIPTION_EVENT_ACTIONS } from "./subscription-event.interface"
import { needsFreshPeriod, periodEnd } from "./subscription.period"

/**
 * Traducción compartida entre el webhook y la reconciliación. Vive en el dominio
 * para que la tabla de estados y las reglas de período tengan un solo origen: si la
 * reconciliación tuviera su propia copia, podría desalinearse del webhook.
 */

export interface TranslatedWhopMembership {
  status: SubscriptionStatus
  cancelAtPeriodEnd: boolean
  action: SubscriptionEventAction
}

/**
 * Traduce el estado que reporta Whop a la fila local. `unresolved`/`drafting` (y
 * cualquier estado desconocido) devuelven `null`: son memberships que todavía no
 * cobran y no deben tocar la DB.
 */
export function translateWhopStatus(membership: WhopMembership): TranslatedWhopMembership | null {
  switch (membership.status) {
    case "active":
    case "trialing":
    case "completed":
      return {
        status: "active",
        // La cancelación programada se sincroniza tal cual la reporta Whop.
        cancelAtPeriodEnd: membership.cancel_at_period_end,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_WHOP_ACTIVATED,
      }
    case "past_due":
      return {
        status: "past_due",
        cancelAtPeriodEnd: false,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_WHOP_PAST_DUE,
      }
    case "canceled":
      return {
        status: "canceled",
        cancelAtPeriodEnd: true,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_WHOP_CANCELED,
      }
    case "expired":
      return {
        status: "expired",
        cancelAtPeriodEnd: true,
        action: SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_WHOP_EXPIRED,
      }
    default:
      return null
  }
}

/**
 * Período del ciclo. `renewal_period_end` es la fuente de verdad cuando Whop lo
 * reporta; si falta, solo se concede un período nuevo cuando el guardado ya venció:
 * nunca se recorta un período que el cliente ya pagó.
 */
function whopPeriod(
  membership: WhopMembership,
  sub: ISubscriptionEntity,
  now: Date,
): Pick<UpdateSubscriptionInput, "current_period_start" | "current_period_end"> {
  if (membership.renewal_period_end) {
    return {
      current_period_end: new Date(membership.renewal_period_end),
      // Sin start en el evento se conserva el guardado; si tampoco hay, arranca hoy.
      current_period_start: membership.renewal_period_start
        ? new Date(membership.renewal_period_start)
        : (sub.current_period_start ?? now),
    }
  }
  if (needsFreshPeriod(sub, now)) {
    return { current_period_start: now, current_period_end: periodEnd(now) }
  }
  return {}
}

/** Dos fechas representan el mismo instante (los `null`/`undefined` vacíos coinciden). */
function sameDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

/**
 * Update completo a aplicar sobre la fila local, o `null` cuando no hay nada que
 * cambiar. El `null` de "sin drift" es lo que permite a la reconciliación contar
 * solo los cambios reales, y al webhook saltarse una escritura redundante.
 */
export function buildMembershipUpdate(
  membership: WhopMembership,
  sub: ISubscriptionEntity,
  now: Date,
): UpdateSubscriptionInput | null {
  const translated = translateWhopStatus(membership)
  if (!translated) return null

  const update: UpdateSubscriptionInput = {
    status: translated.status,
    cancel_at_period_end: translated.cancelAtPeriodEnd,
    ...whopPeriod(membership, sub, now),
  }
  const whopUserId = membership.user?.id
  if (whopUserId) update.whop_user_id = whopUserId

  const drifted =
    update.status !== sub.status ||
    update.cancel_at_period_end !== sub.cancel_at_period_end ||
    (update.current_period_start !== undefined &&
      !sameDate(update.current_period_start, sub.current_period_start)) ||
    (update.current_period_end !== undefined &&
      !sameDate(update.current_period_end, sub.current_period_end)) ||
    (update.whop_user_id !== undefined && update.whop_user_id !== sub.whop_user_id)

  return drifted ? update : null
}
