import { prisma } from "@/config/prisma"
import { NotFoundError } from "@/core/errors/AppError"
import type {
  IGlobalStats,
  IStoresListResponse,
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
}
