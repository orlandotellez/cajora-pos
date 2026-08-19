import type { Prisma } from "@prisma/client"
import type { subscription_event } from "@prisma/client"

export interface SubscriptionActor {
  userId: string | null
  ip: string | null
  userAgent: string | null
}

export const SUBSCRIPTION_EVENT_ACTIONS = {
  CHECKOUT: "checkout",
  ACTIVATE: "activate",
  CANCEL: "cancel",
  REACTIVATE: "reactivate",
  ORPHAN_CLEANED: "orphan_cleaned",
  WEBHOOK_ACTIVATED: "webhook_activated",
  WEBHOOK_CANCELLED: "webhook_cancelled",
  WEBHOOK_SUSPENDED: "webhook_suspended",
  WEBHOOK_EXPIRED: "webhook_expired",
  WEBHOOK_SALE_COMPLETED: "webhook_sale_completed",
  WEBHOOK_PAYMENT_FAILED: "webhook_payment_failed",
} as const
export type SubscriptionEventAction =
  (typeof SUBSCRIPTION_EVENT_ACTIONS)[keyof typeof SUBSCRIPTION_EVENT_ACTIONS]

export interface NewSubscriptionEvent {
  store_id: string | null
  user_id: string | null
  action: SubscriptionEventAction
  paypal_subscription_id?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export interface SubscriptionEventFilters {
  store_id?: string
  user_id?: string
  action?: string
  from?: Date
  to?: Date
  limit: number
  offset: number
}

export interface ISubscriptionEventEntity {
  id: string
  store_id: string | null
  user_id: string | null
  action: string
  paypal_subscription_id: string | null
  metadata: Prisma.JsonValue | null
  created_at: Date
}

export interface ISubscriptionEventRepository {
  create(data: NewSubscriptionEvent): Promise<void>
  findMany(filters: SubscriptionEventFilters): Promise<ISubscriptionEventEntity[]>
  count(filters: Omit<SubscriptionEventFilters, "limit" | "offset">): Promise<number>
}

export const noopSubscriptionEventRepository: ISubscriptionEventRepository = {
  async create() { },
  async findMany() {
    return []
  },
  async count() {
    return 0
  },
}

export type SubscriptionEventEntity = subscription_event
