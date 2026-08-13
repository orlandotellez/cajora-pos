import { prisma } from "@/config/prisma"
import { Prisma } from "@prisma/client"
import type { subscription } from "@prisma/client"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type {
  ISubscriptionEntity,
} from "../domain/subscription.entities"

function mapToEntity(sub: subscription): ISubscriptionEntity {
  return {
    id: sub.id,
    store_id: sub.store_id,
    mode: sub.mode,
    plan: sub.plan,
    status: sub.status,
    paypal_subscription_id: sub.paypal_subscription_id,
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_ends_at: sub.trial_ends_at,
    created_at: sub.created_at,
    updated_at: sub.updated_at,
  }
}

export const SubscriptionRepository: ISubscriptionRepository = {
  async getByStoreId(storeId) {
    const sub = await prisma.subscription.findUnique({
      where: { store_id: storeId },
    })
    return sub ? mapToEntity(sub) : null
  },

  async getByPaypalSubscriptionId(paypalSubscriptionId) {
    const sub = await prisma.subscription.findUnique({
      where: { paypal_subscription_id: paypalSubscriptionId },
    })
    return sub ? mapToEntity(sub) : null
  },

  async findPaypalSubscriptions(skip, take) {
    const subs = await prisma.subscription.findMany({
      where: { paypal_subscription_id: { not: null } },
      orderBy: { created_at: "asc" },
      skip,
      take,
    })
    return subs.map(mapToEntity)
  },

  async upsertCloud(storeId, data) {
    const sub = await prisma.subscription.upsert({
      where: { store_id: storeId },
      create: {
        store_id: storeId,
        mode: data.mode,
        plan: data.plan,
        status: data.status,
        trial_ends_at: data.trial_ends_at,
      },
      update: {
        mode: data.mode,
        plan: data.plan,
        status: data.status,
        trial_ends_at: data.trial_ends_at,
      },
    })
    return mapToEntity(sub)
  },

  async update(storeId, data) {
    try {
      const sub = await prisma.subscription.update({
        where: { store_id: storeId },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.plan !== undefined && { plan: data.plan }),
          ...(data.paypal_subscription_id !== undefined && {
            paypal_subscription_id: data.paypal_subscription_id,
          }),
          ...(data.current_period_start !== undefined && {
            current_period_start: data.current_period_start,
          }),
          ...(data.current_period_end !== undefined && {
            current_period_end: data.current_period_end,
          }),
          ...(data.cancel_at_period_end !== undefined && {
            cancel_at_period_end: data.cancel_at_period_end,
          }),
          ...(data.trial_ends_at !== undefined && { trial_ends_at: data.trial_ends_at }),
        },
      })
      return mapToEntity(sub)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return null
      }
      throw err
    }
  },
}
