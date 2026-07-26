import { NotFoundError, BadRequestError } from "@/core/errors/AppError"
import { prisma } from "@/config/prisma"
import type { ISaleRepository } from "../domain/sales.interface"
import type { ISaleResponse, ISaleListResponse, ISaleReport, IRevenueTrendItem, IRevenueTrendQuery } from "../domain/sales.types"
import type { CreateSaleData, ISaleEntity, ISaleItemEntity, ISaleServiceEntity, ISaleServiceProductEntity } from "../domain/sales.entities"

/** Extended sale entity that includes nested item/service relations */
interface RichSaleService extends ISaleServiceEntity {
  products?: ISaleServiceProductEntity[]
}
interface RichSale extends ISaleEntity {
  items?: ISaleItemEntity[]
  service_items?: RichSaleService[]
}

function mapSaleToResponse(sale: RichSale): ISaleResponse {
  return {
    id: sale.id,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total: Number(sale.total),
    payment_method: sale.payment_method,
    amount_received: sale.amount_received ? Number(sale.amount_received) : undefined,
    change_given: sale.change_given ? Number(sale.change_given) : undefined,
    user_id: sale.user_id,
    user_name: sale.user_name,
    created_at: sale.created_at instanceof Date ? sale.created_at.toISOString() : sale.created_at,
    items: sale.items?.map((item: ISaleItemEntity) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    service_items: sale.service_items?.map((si: RichSaleService) => ({
      id: si.id,
      service_id: si.service_id,
      service_name: si.service_name,
      base_price: Number(si.base_price),
      line_total: Number(si.line_total),
      products: si.products?.map((sp: ISaleServiceProductEntity) => ({
        id: sp.id,
        product_id: sp.product_id,
        product_name: sp.product_name,
        quantity: sp.quantity,
        unit_price: Number(sp.unit_price),
        line_total: Number(sp.line_total),
        affects_price: sp.affects_price ?? false,
      })) || [],
    })),
  }
}

export const createSaleService = (repository: ISaleRepository) => ({
  create: async (data: CreateSaleData, storeId: string): Promise<ISaleResponse> => {
    /*
     * Stock validation is done per-product considering ALL sources:
     *   regular items + service products (custom and auto-lookup).
     * This is correct — if a service consumes product X and the user also
     * added X as a regular item, both quantities must be deducted from stock.
     *
     * HOWEVER, serviceProductsToDeduct must ONLY contain products that come
     * from services (sections 2a/2b), NOT regular items (section 1).
     * Otherwise the repository would double-deduct regular items.
     */

    // Map for stock validation ONLY (regular + service combined)
    const validationMap = new Map<string, { name: string; quantity: number; stock: number }>()
    // Map for service-originating products (to be deducted by the repository)
    const serviceProductMap = new Map<string, number>()
    let customServiceProducts: Map<string, { product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }[]> | undefined

    // 1. Regular product items — validate stock
    if (data.items && data.items.length > 0) {
      const productIds = data.items.map((i) => i.product_id)
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, stock: true },
      })
      const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]))
      for (const item of data.items) {
        const dbProd = dbProductMap.get(item.product_id)
        if (!dbProd) throw new NotFoundError(`Product ${item.product_id} not found`)
        const existing = validationMap.get(item.product_id) || {
          name: dbProd.name,
          quantity: 0,
          stock: dbProd.stock,
        }
        existing.quantity += item.quantity
        validationMap.set(item.product_id, existing)
      }
    }

    // 2. If service_items exist, resolve the associated products
    if (data.service_items && data.service_items.length > 0) {
      customServiceProducts = new Map()

      const itemsWithCustomProducts = data.service_items.filter((si) => si.products && si.products.length > 0)
      const itemsWithoutCustom = data.service_items.filter((si) => !si.products || si.products.length === 0)

      // 2a. Process items with CUSTOM products
      if (itemsWithCustomProducts.length > 0) {
        const customProductIds = itemsWithCustomProducts.flatMap((si) =>
          si.products!.map((sp) => sp.product_id)
        )
        const dbProducts = await prisma.product.findMany({
          where: { id: { in: customProductIds } },
          select: { id: true, name: true, price: true, stock: true },
        })
        const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]))

        for (const si of itemsWithCustomProducts) {
          const sps: { product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }[] = []
          for (const sp of si.products!) {
            const dbProd = dbProductMap.get(sp.product_id)
            if (!dbProd) throw new NotFoundError(`Product ${sp.product_id} not found`)

            // Update validation map
            const existing = validationMap.get(sp.product_id) || {
              name: dbProd.name,
              quantity: 0,
              stock: dbProd.stock,
            }
            existing.quantity += sp.quantity
            validationMap.set(sp.product_id, existing)

            // Track service-originating product for deduction
            serviceProductMap.set(sp.product_id, (serviceProductMap.get(sp.product_id) || 0) + sp.quantity)

            sps.push(sp)
          }
          customServiceProducts.set(si.service_id, sps)
        }
      }

      // 2b. Process items WITHOUT custom products (auto-lookup from service_product)
      if (itemsWithoutCustom.length > 0) {
        const serviceIds = itemsWithoutCustom.map((si) => si.service_id)
        const serviceProducts = await prisma.service_product.findMany({
          where: { service_id: { in: serviceIds } },
          include: { product: { select: { id: true, name: true, price: true, stock: true } } },
        })

        for (const sp of serviceProducts) {
          // Update validation map
          const existing = validationMap.get(sp.product_id) || {
            name: sp.product.name,
            quantity: 0,
            stock: sp.product.stock,
          }
          existing.quantity += sp.quantity
          validationMap.set(sp.product_id, existing)

          // Track service-originating product for deduction
          serviceProductMap.set(sp.product_id, (serviceProductMap.get(sp.product_id) || 0) + sp.quantity)
        }
      }

      if (serviceProductMap.size === 0 && (!data.items || data.items.length === 0)) {
        throw new BadRequestError("No products found for the selected services")
      }
    }

    // 3. Stock validation across ALL products (regular + service)
    if (validationMap.size > 0) {
      const insufficientStock: string[] = []
      for (const [, info] of validationMap) {
        if (info.stock < info.quantity) {
          insufficientStock.push(`${info.name} (disponible: ${info.stock}, requerido: ${info.quantity})`)
        }
      }
      if (insufficientStock.length > 0) {
        throw new BadRequestError(
          `Insufficient stock for: ${insufficientStock.join(", ")}`
        )
      }
    }

    // Build serviceProductsToDeduct from service-originating products ONLY
    const serviceProductsToDeduct = Array.from(serviceProductMap.entries()).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }))

    const sale = await repository.create(data, storeId, serviceProductsToDeduct, customServiceProducts)
    return mapSaleToResponse(sale)
  },

  getById: async (id: string, storeId: string): Promise<ISaleResponse> => {
    const sale = await repository.findById(id, storeId)
    if (!sale) {
      throw new NotFoundError("Sale not found")
    }
    return mapSaleToResponse(sale)
  },

  list: async (params?: { start_date?: string; end_date?: string; user_id?: string; payment_method?: string; q?: string; min_total_qty?: number; min_items_count?: number; page?: number; limit?: number; storeId?: string }): Promise<ISaleListResponse> => {
    const result = await repository.findAll({
      startDate: params?.start_date ? new Date(params.start_date) : undefined,
      endDate: params?.end_date ? new Date(params.end_date) : undefined,
      userId: params?.user_id,
      paymentMethod: params?.payment_method,
      q: params?.q,
      minTotalQty: params?.min_total_qty,
      minItemsCount: params?.min_items_count,
      page: params?.page,
      limit: params?.limit,
      storeId: params?.storeId,
    })

    return {
      sales: result.sales.map(mapSaleToResponse),
      total: result.total,
      page: params?.page || 1,
      limit: params?.limit || 50,
    }
  },

  getReport: async (params?: { start_date?: string; end_date?: string; storeId?: string }): Promise<ISaleReport> => {
    const report = await repository.getReport({
      startDate: params?.start_date ? new Date(params.start_date) : undefined,
      endDate: params?.end_date ? new Date(params.end_date) : undefined,
      storeId: params?.storeId,
    })

    return {
      total_sales: report.totalSales,
      total_revenue: report.totalRevenue,
      total_discount: report.totalDiscount,
      average_ticket: report.averageTicket,
      sales_by_payment_method: report.salesByPaymentMethod,
      top_products: report.topProducts.map(p => ({
        product_name: p.productName,
        quantity: p.quantity,
        revenue: p.revenue,
      })),
    }
  },

  getRevenueTrend: async (params: IRevenueTrendQuery): Promise<IRevenueTrendItem[]> => {
    const items = await repository.getRevenueTrend({
      startDate: new Date(params.start_date),
      endDate: new Date(params.end_date),
      groupBy: params.group_by,
      storeId: params.store_id,
    })
    return items
  },
})
