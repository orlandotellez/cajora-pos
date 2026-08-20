import { Prisma } from "@prisma/client"
import type { subscription_event } from "@prisma/client"
import { prisma } from "@/config/prisma"
import type {
  ISubscriptionEventEntity,
  ISubscriptionEventRepository,
  NewSubscriptionEvent,
  SubscriptionEventFilters,
} from "../domain/subscription-event.interface"

function mapToEntity(ev: subscription_event): ISubscriptionEventEntity {
  return {
    id: ev.id,
    store_id: ev.store_id,
    user_id: ev.user_id,
    action: ev.action,
    paypal_subscription_id: ev.paypal_subscription_id,
    metadata: ev.metadata,
    period_start: ev.period_start,
    created_at: ev.created_at,
  }
}

function buildWhere(
  filters: Omit<SubscriptionEventFilters, "limit" | "offset">,
): Prisma.subscription_eventWhereInput {
  const where: Prisma.subscription_eventWhereInput = {}
  if (filters.store_id) where.store_id = filters.store_id
  if (filters.user_id) where.user_id = filters.user_id
  if (filters.action) where.action = filters.action
  if (filters.from || filters.to) {
    where.created_at = {}
    if (filters.from) where.created_at.gte = filters.from
    if (filters.to) where.created_at.lte = filters.to
  }
  return where
}

export const SubscriptionEventRepository: ISubscriptionEventRepository = {
  async create(data: NewSubscriptionEvent): Promise<void> {
    await prisma.subscription_event.create({
      data: {
        store_id: data.store_id,
        user_id: data.user_id,
        action: data.action,
        paypal_subscription_id: data.paypal_subscription_id ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        period_start: data.period_start ?? undefined,
        created_at: data.created_at ?? undefined,
      },
    })
  },

  async createIdempotent(data: NewSubscriptionEvent): Promise<ISubscriptionEventEntity | null> {
    try {
      const ev = await prisma.subscription_event.create({
        data: {
          store_id: data.store_id,
          user_id: data.user_id,
          action: data.action,
          paypal_subscription_id: data.paypal_subscription_id ?? null,
          metadata: (data.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
          period_start: data.period_start ?? undefined,
          created_at: data.created_at ?? undefined,
        },
      })
      return mapToEntity(ev)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return null
      }
      throw err
    }
  },

  async findMany(filters: SubscriptionEventFilters): Promise<ISubscriptionEventEntity[]> {
    const events = await prisma.subscription_event.findMany({
      where: buildWhere(filters),
      orderBy: { created_at: "desc" },
      skip: filters.offset,
      take: filters.limit,
    })
    return events.map(mapToEntity)
  },

  async count(filters: Omit<SubscriptionEventFilters, "limit" | "offset">): Promise<number> {
    return prisma.subscription_event.count({ where: buildWhere(filters) })
  },
}
