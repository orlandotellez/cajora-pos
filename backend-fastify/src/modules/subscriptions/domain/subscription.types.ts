import { BILLING_MODE, SUBSCRIPTION_STATUS, SUBSCRIPTION_PLAN } from "@prisma/client"

export type BillingMode = (typeof BILLING_MODE)[keyof typeof BILLING_MODE]
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN]

export interface ISubscriptionResponse {
  mode: BillingMode
  plan: SubscriptionPlan
  status: SubscriptionStatus
  paypal_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_ends_at: string | null
}
