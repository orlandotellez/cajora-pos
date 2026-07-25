import { prisma } from "@/config/prisma"
import type { ISaleRepository } from "../domain/sales.interface"
import type { ISaleEntity, CreateSaleData, CreateSaleServiceItemProductData } from "../domain/sales.entities"
import { mapPrismaSaleToEntity } from "./mappers/sales.prisma.mappers"
import { Prisma } from "@prisma/client"

type SaleWhereInput = Prisma.saleWhereInput

const saleInclude = {
  items: true,
  service_items: {
    include: {
      product: { select: { id: true, name: true, price: true } },
    },
  },
} as const

type ServiceProductWithProduct = Prisma.service_productGetPayload<{
  include: { product: { select: { id: true; name: true; price: true } } }
}>

export const SaleRepository: ISaleRepository = {
  async create(data: CreateSaleData, storeId: string, serviceProductsToDeduct?: { product_id: string; quantity: number }[], customServiceProducts?: Map<string, CreateSaleServiceItemProductData[]>) {
    // Use a transaction for atomicity: create sale + deduct inventory
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create the sale with items
      const created = await tx.sale.create({
        data: {
          subtotal: data.subtotal,
          discount: data.discount,
          total: data.total,
          payment_method: data.payment_method,
          amount_received: data.amount_received,
          change_given: data.change_given,
          store_id: storeId,
          user_id: data.user_id,
          user_name: data.user_name,
          items: {
            create: data.items.map((item) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
            })),
          },
          ...(data.service_items && data.service_items.length > 0
            ? {
              service_items: {
                create: data.service_items.map((si) => ({
                  service_id: si.service_id,
                  service_name: si.service_name,
                  base_price: si.base_price,
                  line_total: si.line_total,
                  products: {
                    create: [], // Will be populated below
                  },
                })),
              },
            }
            : {}),
        },
        include: {
          items: true,
          service_items: {
            include: { products: true },
          },
        },
      })

      // 2. Create sale_service_product records
      if (data.service_items && data.service_items.length > 0 && created.service_items) {
        // Fetch auto-lookup products for items that don't have custom products
        const itemsWithoutCustom = data.service_items.filter((si) => !si.products || si.products.length === 0)
        let autoLookupProducts: ServiceProductWithProduct[] = []
        if (itemsWithoutCustom.length > 0) {
          autoLookupProducts = await tx.service_product.findMany({
            where: {
              service_id: { in: itemsWithoutCustom.map((si) => si.service_id) },
            },
            include: {
              product: { select: { id: true, name: true, price: true } },
            },
          })
        }

        for (const saleService of created.service_items) {
          const originalItem = data.service_items.find((si) => si.service_id === saleService.service_id)

          // Check if this item has custom products
          const customSps = customServiceProducts?.get(saleService.service_id)

          if (customSps && customSps.length > 0) {
            // Use custom products from the request
            await tx.sale_service_product.createMany({
              data: customSps.map((sp) => ({
                sale_service_id: saleService.id,
                product_id: sp.product_id,
                product_name: sp.product_name,
                quantity: sp.quantity,
                unit_price: sp.unit_price,
                line_total: sp.line_total,
                affects_price: sp.affects_price ?? false,
              })),
            })
          } else {
            // Auto-lookup from service_product table
            const sps = autoLookupProducts.filter((sp) => sp.service_id === saleService.service_id)
            if (sps.length > 0) {
              await tx.sale_service_product.createMany({
                data: sps.map((sp) => ({
                  sale_service_id: saleService.id,
                  product_id: sp.product_id,
                  product_name: sp.product.name,
                  quantity: sp.quantity,
                  unit_price: Number(sp.product.price),
                  line_total: Number(sp.product.price) * sp.quantity,
                })),
              })
            }
          }
        }
      }

      // 3. Deduct inventory for sale items (regular products)
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } },
        })

        await tx.inventory_movement.create({
          data: {
            product_id: item.product_id,
            store_id: storeId,
            movement_type: "venta",
            quantity: item.quantity,
            note: `Venta #${created.id.slice(0, 8)}`,
            user_id: data.user_id,
          },
        })
      }

      // 4. Deduct inventory for service products
      if (serviceProductsToDeduct) {
        for (const sp of serviceProductsToDeduct) {
          await tx.product.update({
            where: { id: sp.product_id },
            data: { stock: { decrement: sp.quantity } },
          })

          await tx.inventory_movement.create({
            data: {
              product_id: sp.product_id,
              store_id: storeId,
              movement_type: "venta",
              quantity: sp.quantity,
              note: `Servicio en venta #${created.id.slice(0, 8)}`,
              user_id: data.user_id,
            },
          })
        }
      }

      // 5. Re-fetch with full relations for the response
      const fullSale = await tx.sale.findUnique({
        where: { id: created.id },
        include: {
          items: true,
          service_items: {
            include: { products: true },
          },
        },
      })

      return fullSale!
    })

    return mapPrismaSaleToEntity(sale)
  },

  async findById(id: string, storeId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id, store_id: storeId },
      include: {
        items: true,
        service_items: {
          include: { products: true },
        },
      },
    })
    if (!sale) return null
    return mapPrismaSaleToEntity(sale)
  },

  async findAll(params) {
    const where: SaleWhereInput = {}

    if (params?.storeId) where.store_id = params.storeId

    if (params?.startDate || params?.endDate) {
      where.created_at = {
        ...(params.startDate && { gte: params.startDate }),
        ...(params.endDate && { lte: params.endDate }),
      }
    }
    if (params?.userId) where.user_id = params.userId
    if (params?.paymentMethod) where.payment_method = params.paymentMethod

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: true,
          service_items: {
            include: { products: true },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.sale.count({ where }),
    ])

    return {
      sales: sales.map(mapPrismaSaleToEntity),
      total,
    }
  },

  async getReport(params) {
    const where: any = {}

    if (params?.storeId) where.store_id = params.storeId

    if (params?.startDate || params?.endDate) {
      where.created_at = {}
      if (params.startDate) where.created_at.gte = params.startDate
      if (params.endDate) where.created_at.lte = params.endDate
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        service_items: {
          include: { products: true },
        },
      },
    })

    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
    const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount), 0)
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

    const salesByPaymentMethod: Record<string, number> = {}
    for (const sale of sales) {
      salesByPaymentMethod[sale.payment_method] = (salesByPaymentMethod[sale.payment_method] || 0) + Number(sale.total)
    }

    const productMap = new Map<string, { productName: string; quantity: number; revenue: number }>()
    for (const sale of sales) {
      // Regular items
      for (const item of sale.items) {
        const existing = productMap.get(item.product_id) || { productName: item.product_name, quantity: 0, revenue: 0 }
        existing.quantity += item.quantity
        existing.revenue += Number(item.line_total)
        productMap.set(item.product_id, existing)
      }
      // Service products
      if (sale.service_items) {
        for (const si of sale.service_items) {
          if (si.products) {
            for (const sp of si.products) {
              const existing = productMap.get(sp.product_id) || { productName: sp.product_name, quantity: 0, revenue: 0 }
              existing.quantity += sp.quantity
              existing.revenue += Number(sp.line_total)
              productMap.set(sp.product_id, existing)
            }
          }
        }
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      totalSales,
      totalRevenue,
      totalDiscount,
      averageTicket,
      salesByPaymentMethod,
      topProducts,
    }
  },

  async getRevenueTrend(params) {
    const truncMap = { day: "day", week: "week", month: "month" } as const
    const trunc = truncMap[params.groupBy]

    const rows = await prisma.$queryRawUnsafe<Array<{ date: Date; revenue: number }>>(
      `SELECT DATE_TRUNC('${trunc}', created_at AT TIME ZONE 'UTC') as date,
              CAST(SUM(total) AS DECIMAL(10,2)) as revenue
       FROM sales
       WHERE store_id = $1::text
         AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz
       GROUP BY DATE_TRUNC('${trunc}', created_at AT TIME ZONE 'UTC')
       ORDER BY date ASC`,
      params.storeId,
      params.startDate,
      params.endDate,
    )

    return rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      revenue: Number(r.revenue),
    }))
  },
}
