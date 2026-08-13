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
  trial_ends_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CloudTrialInput {
  mode: "cloud"
  plan: SubscriptionPlan
  status: "trial"
  trial_ends_at: Date
}

export type UpdateSubscriptionInput = {
  status?: SubscriptionStatus
  plan?: SubscriptionPlan
  paypal_subscription_id?: string | null
  current_period_start?: Date | null
  current_period_end?: Date | null
  cancel_at_period_end?: boolean
  trial_ends_at?: Date | null
}
