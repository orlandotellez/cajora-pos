import type { Decimal } from "@prisma/client/runtime/library"

export interface ISaleEntity {
  id: string
  subtotal: Decimal
  discount: Decimal
  total: Decimal
  payment_method: string
  amount_received?: Decimal
  change_given?: Decimal
  user_id: string
  created_at: Date
  updated_at: Date
  items?: ISaleItemEntity[]
  service_items?: ISaleServiceEntity[]
}

export interface ISaleItemEntity {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: Decimal
  line_total: Decimal
  created_at: Date
  updated_at: Date
}

export type CreateSaleItemData = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface ISaleServiceEntity {
  id: string
  sale_id: string
  service_id: string
  service_name: string
  base_price: Decimal
  line_total: Decimal
  created_at: Date
  products?: ISaleServiceProductEntity[]
}

export interface ISaleServiceProductEntity {
  id: string
  sale_service_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: Decimal
  line_total: Decimal
  affects_price: boolean
  created_at: Date
}

export type CreateSaleServiceItemProductData = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  affects_price?: boolean
}

export type CreateSaleServiceItemData = {
  service_id: string
  service_name: string
  base_price: number
  line_total: number
  products?: CreateSaleServiceItemProductData[]
}

export type CreateSaleData = {
  subtotal: number
  discount: number
  total: number
  payment_method: string
  amount_received?: number
  change_given?: number
  user_id: string
  items: CreateSaleItemData[]
  service_items?: CreateSaleServiceItemData[]
}
