import type { ISubscriptionEntity } from "../../domain/subscription.entities"
import type { ISubscriptionResponse } from "../../domain/subscription.types"

export function mapToResponse(sub: ISubscriptionEntity): ISubscriptionResponse {
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