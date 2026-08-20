export interface ISaleItemResponse {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface ISaleServiceProductResponse {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  affects_price: boolean
}

export interface ISaleServiceResponse {
  id: string
  service_id: string
  service_name: string
  base_price: number
  line_total: number
  products: ISaleServiceProductResponse[]
}

export interface ISaleResponse {
  id: string
  subtotal: number
  discount: number
  total: number
  payment_method: string
  amount_received?: number
  change_given?: number
  user_id: string
  user_name: string
  client_id?: string
  client_name?: string
  created_at: string
  items?: ISaleItemResponse[]
  service_items?: ISaleServiceResponse[]
}

export interface ISaleListResponse {
  sales: ISaleResponse[]
  total: number
  page: number
  limit: number
}

export interface ISaleReport {
  total_sales: number
  total_revenue: number
  total_discount: number
  average_ticket: number
  sales_by_payment_method: Record<string, number>
  top_products: { product_name: string; quantity: number; revenue: number }[]
}

export interface ISaleQueryParams {
  start_date?: string
  end_date?: string
  user_id?: string
  payment_method?: string
  page?: number
  limit?: number
}

export interface IRevenueTrendItem {
  date: string
  revenue: number
}

export type GroupBy = "day" | "week" | "month"

export interface IRevenueTrendQuery {
  start_date: string
  end_date: string
  group_by: GroupBy
  store_id: string
}

export interface IRevenueByHourItem {
  hour: number
  revenue: number
  sales: number
}

export interface IRevenueByHourQuery {
  start_date: string
  end_date: string
  store_id: string
}

export interface IRevenueByCategoryItem {
  category_name: string
  revenue: number
  quantity: number
}

export interface IRevenueByCategoryQuery {
  start_date: string
  end_date: string
  store_id: string
}
