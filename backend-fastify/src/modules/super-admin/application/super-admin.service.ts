import { Prisma } from "@prisma/client"
import { prisma } from "@/config/prisma"
import { NotFoundError } from "@/core/errors/AppError"
import type {
  IGlobalStats,
  IStoresListResponse,
  ISubscriptionEventsFilters,
  ISubscriptionEventsResponse,
  ISubscriptionHealthResponse,
  IStoreUsersResponse,
} from "../domain/super-admin.types"

function startOfToday(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export const superAdminService = {
  async getStats(): Promise<IGlobalStats> {
    const startToday = startOfToday()
    const startMonth = startOfMonth()

    const [storesTotal, storesThisMonth, usersByRole, productsTotal, productsActive, lowStockRaw] =
      await Promise.all([
        prisma.store.count(),
        prisma.store.count({ where: { created_at: { gte: startMonth } } }),
        prisma.user.groupBy({
          by: ["role"],
          where: { deleted_at: null },
          _count: { _all: true },
        }),
        prisma.product.count({ where: { deleted_at: null } }),
        prisma.product.count({ where: { deleted_at: null, active: true } }),
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM "products"
          WHERE "deleted_at" IS NULL AND "active" = true AND "stock" <= "low_stock_threshold"
        `,
      ])

    const roleCount = (role: string) =>
      usersByRole.find((r) => r.role === role)?._count._all ?? 0

    // El total excluye cuentas super_admin: el panel observa las tiendas,
    // y la cuenta del owner no debería contaminar los conteos.
    const admins = roleCount("admin")
    const cashiers = roleCount("cajero")
    const superAdmins = roleCount("super_admin")

    const [salesTotal, salesToday, salesThisMonth] = await Promise.all([
      prisma.sale.count(),
      prisma.sale.count({ where: { created_at: { gte: startToday } } }),
      prisma.sale.count({ where: { created_at: { gte: startMonth } } }),
    ])

    return {
      stores: {
        total: storesTotal,
        created_this_month: storesThisMonth,
      },
      users: {
        total: admins + cashiers,
        admins,
        cashiers,
        super_admins: superAdmins,
      },
      products: {
        total: productsTotal,
        active: productsActive,
        low_stock: Number(lowStockRaw[0]?.count ?? 0),
      },
      sales: {
        total: salesTotal,
        today: salesToday,
        this_month: salesThisMonth,
      },
    }
  },

  async getStores(): Promise<IStoresListResponse> {
    const stores = await prisma.store.findMany({
      orderBy: { created_at: "asc" },
    })
    const storeIds = stores.map((s) => s.id)

    const [usersByStore, productsByStore, servicesByStore] = await Promise.all([
      prisma.user.groupBy({
        by: ["store_id"],
        where: { store_id: { in: storeIds }, deleted_at: null },
        _count: { _all: true },
      }),
      prisma.product.groupBy({
        by: ["store_id"],
        where: { store_id: { in: storeIds }, deleted_at: null },
        _count: { _all: true },
      }),
      prisma.service.groupBy({
        by: ["store_id"],
        where: { store_id: { in: storeIds }, deleted_at: null },
        _count: { _all: true },
      }),
    ])

    const usersMap = new Map(usersByStore.map((r) => [r.store_id, r._count._all]))
    const productsMap = new Map(productsByStore.map((r) => [r.store_id, r._count._all]))
    const servicesMap = new Map(servicesByStore.map((r) => [r.store_id, r._count._all]))

    return {
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address ?? null,
        phone: s.phone ?? null,
        created_at: s.created_at,
        users_count: usersMap.get(s.id) ?? 0,
        products_count: productsMap.get(s.id) ?? 0,
        services_count: servicesMap.get(s.id) ?? 0,
      })),
      total: stores.length,
    }
  },

  async getStoreUsers(storeId: string): Promise<IStoreUsersResponse> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    })
    if (!store) throw new NotFoundError("Store not found")

    const users = await prisma.user.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        email_verified: true,
        role: true,
        is_owner: true,
        phone: true,
        created_at: true,
        deleted_at: true,
      },
    })

    return {
      users,
      total: users.length,
    }
  },

  async getSubscriptionEvents(
    filters: ISubscriptionEventsFilters,
  ): Promise<ISubscriptionEventsResponse> {
    const where: Prisma.subscription_eventWhereInput = {}
    if (filters.store_id) where.store_id = filters.store_id
    if (filters.user_id) where.user_id = filters.user_id
    if (filters.action) where.action = filters.action
    if (filters.from || filters.to) {
      where.created_at = {}
      if (filters.from) where.created_at.gte = new Date(filters.from)
      if (filters.to) where.created_at.lte = new Date(filters.to)
    }

    const [events, total] = await Promise.all([
      prisma.subscription_event.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: filters.offset,
        take: filters.limit,
        include: {
          store: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.subscription_event.count({ where }),
    ])

    return {
      events: events.map((e) => ({
        id: e.id,
        store_id: e.store_id,
        store_name: e.store?.name ?? null,
        user_id: e.user_id,
        user_name: e.user?.name ?? null,
        user_email: e.user?.email ?? null,
        action: e.action,
        paypal_subscription_id: e.paypal_subscription_id,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
      total,
    }
  },

  async getSubscriptionHealth(): Promise<ISubscriptionHealthResponse> {
    // Conteo de suscripciones por estado
    const [statusCounts, modeCounts] = await Promise.all([
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ["mode"],
        _count: { _all: true },
      }),
    ])

    const countByStatus = (status: string) =>
      statusCounts.find((r) => r.status === status)?._count._all ?? 0
    const countByMode = (mode: string) =>
      modeCounts.find((r) => r.mode === mode)?._count._all ?? 0

    const total = statusCounts.reduce((acc, r) => acc + r._count._all, 0)

    const summary = {
      total,
      active: countByStatus("active"),
      past_due: countByStatus("past_due"),
      canceled: countByStatus("canceled"),
      expired: countByStatus("expired"),
      pending: countByStatus("pending"),
      cloud_total: countByMode("cloud"),
      self_hosted_total: countByMode("self_hosted"),
    }

    // Tiendas con suscripciones problemáticas
    const problemSubs = await prisma.subscription.findMany({
      where: { status: { in: ["past_due", "canceled", "expired"] } },
      include: {
        store: { select: { name: true } },
      },
      orderBy: { updated_at: "desc" },
    })

    // Owner de cada tienda problemática
    const storeIds = problemSubs.map((s) => s.store_id)
    const owners = storeIds.length > 0
      ? await prisma.user.findMany({
        where: { store_id: { in: storeIds }, is_owner: true, deleted_at: null },
        select: { store_id: true, name: true, email: true },
      })
      : []
    const ownerMap = new Map(owners.map((o) => [o.store_id, o]))

    // Último evento fallido de cada tienda problemática
    const lastEvents = storeIds.length > 0
      ? await prisma.subscription_event.findMany({
        where: {
          store_id: { in: storeIds },
          action: {
            in: [
              "webhook_payment_failed",
              "webhook_suspended",
              "webhook_cancelled",
              "webhook_expired",
            ],
          },
        },
        orderBy: { created_at: "desc" },
        take: storeIds.length,
        distinct: ["store_id"],
        select: {
          store_id: true,
          action: true,
          created_at: true,
        },
      })
      : []
    const lastEventMap = new Map(lastEvents.map((e) => [e.store_id, e]))

    const problem_stores = problemSubs.map((sub) => {
      const owner = ownerMap.get(sub.store_id)
      const lastEvent = lastEventMap.get(sub.store_id)
      const periodEnd = sub.current_period_end
      const daysUntilExpiry = periodEnd
        ? Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000)
        : null

      return {
        store_id: sub.store_id,
        store_name: sub.store?.name ?? "Desconocida",
        owner_name: owner?.name ?? null,
        owner_email: owner?.email ?? null,
        status: sub.status,
        plan: sub.plan,
        mode: sub.mode,
        current_period_end: periodEnd?.toISOString() ?? null,
        cancel_at_period_end: sub.cancel_at_period_end,
        last_event_action: lastEvent?.action ?? null,
        last_event_at: lastEvent?.created_at?.toISOString() ?? null,
        days_until_expiry: daysUntilExpiry,
      }
    })

    // Eventos fallidos recientes
    const recentEvents = await prisma.subscription_event.findMany({
      where: {
        action: {
          in: [
            "webhook_payment_failed",
            "webhook_suspended",
            "webhook_cancelled",
            "webhook_expired",
          ],
        },
      },
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        store: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    })

    const recent_events = recentEvents.map((e) => ({
      id: e.id,
      store_id: e.store_id,
      store_name: e.store?.name ?? null,
      user_id: e.user_id,
      user_name: e.user?.name ?? null,
      user_email: e.user?.email ?? null,
      action: e.action,
      paypal_subscription_id: e.paypal_subscription_id,
      metadata: e.metadata,
      created_at: e.created_at,
    }))

    return { summary, problem_stores, recent_events }
  },
}
