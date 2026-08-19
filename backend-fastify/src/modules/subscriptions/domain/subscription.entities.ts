import type {
  BillingMode,
  SubscriptionStatus,
  SubscriptionPlan,
} from "./subscription.types"

export interface ISubscriptionEntity {
  id: string
  store_id: string
  mode: BillingMode
  plan: SubscriptionPlan
  status: SubscriptionStatus
  paypal_subscription_id: string | null
  current_period_start: Date | null
  current_period_end: Date | null
  cancel_at_period_end: boolean
  created_at: Date
  updated_at: Date
}

export interface CloudPendingInput {
  mode: "cloud"
  plan: SubscriptionPlan
  status: "pending"
  paypal_subscription_id?: string | null
}

export type UpdateSubscriptionInput = {
  status?: SubscriptionStatus
  plan?: SubscriptionPlan
  paypal_subscription_id?: string | null
  current_period_start?: Date | null
  current_period_end?: Date | null
  cancel_at_period_end?: boolean
}
