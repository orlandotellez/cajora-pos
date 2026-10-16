import type { Prisma } from "@/generated/prisma/client"

export interface IServiceEntity {
  id: string
  name: string
  description?: string
  base_price: Prisma.Decimal
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date
  service_products?: IServiceProductEntity[]
}

export interface IServiceProductEntity {
  id: string
  service_id: string
  product_id: string
  quantity: number
  product?: {
    id: string
    name: string
    price: Prisma.Decimal
  }
}

export type CreateServiceData = {
  name: string
  description?: string
  base_price: number
  is_active?: boolean
  products?: { product_id: string; quantity: number }[]
}

export type UpdateServiceData = {
  name?: string
  description?: string | null
  base_price?: number
  is_active?: boolean
  products?: { product_id: string; quantity: number }[]
}
