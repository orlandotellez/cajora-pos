import type { Decimal } from "@prisma/client/runtime/library"

export interface IProductEntity {
  id: string
  barcode?: string
  name: string
  unit_type?: string
  unit_quantity?: number
  category_id?: string
  category_name?: string
  supplier_id?: string
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
  price: Decimal
  cost: Decimal
  stock: number
  low_stock_threshold: number
  active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type CreateProductData = {
  barcode?: string
  name: string
  unit_type?: string
  unit_quantity?: number
  category_id?: string
  supplier_id?: string
  price: number
  cost?: number
  stock?: number
  low_stock_threshold?: number
  active?: boolean
}

export type UpdateProductData = Partial<CreateProductData>
