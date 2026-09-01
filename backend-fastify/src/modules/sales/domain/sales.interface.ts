import type { ISaleEntity, ISaleItemEntity, CreateSaleData, CreateSaleServiceItemProductData } from "./sales.entities"
import type { IRevenueByHourItem, IRevenueByCategoryItem, IProductPerformanceItem } from "./sales.types"

export interface ISaleRepository {
  create(data: CreateSaleData, storeId: string, serviceProductsToDeduct?: { product_id: string; quantity: number }[], customServiceProducts?: Map<string, CreateSaleServiceItemProductData[]>): Promise<ISaleEntity>
  findById(id: string, storeId: string): Promise<ISaleEntity | null>
  findAll(params?: { startDate?: Date; endDate?: Date; userId?: string; paymentMethod?: string; q?: string; minTotalQty?: number; minItemsCount?: number; page?: number; limit?: number; storeId?: string }): Promise<{ sales: ISaleEntity[]; total: number }>
  getReport(params?: { startDate?: Date; endDate?: Date; storeId?: string }): Promise<{
    totalSales: number
    totalRevenue: number
    totalDiscount: number
    averageTicket: number
    salesByPaymentMethod: Record<string, number>
    topProducts: { productName: string; quantity: number; revenue: number }[]
  }>

  getRevenueTrend(params: { startDate: Date; endDate: Date; groupBy: "day" | "week" | "month"; storeId: string }): Promise<{ date: string; revenue: number }[]>

  getRevenueByHour(params: { startDate: Date; endDate: Date; storeId: string }): Promise<IRevenueByHourItem[]>

  getRevenueByCategory(params: { startDate: Date; endDate: Date; storeId: string }): Promise<IRevenueByCategoryItem[]>

  getProductPerformance(params: { startDate: Date; endDate: Date; storeId: string }): Promise<IProductPerformanceItem[]>
}
