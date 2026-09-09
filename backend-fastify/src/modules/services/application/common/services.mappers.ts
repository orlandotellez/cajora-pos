import type { IServiceResponse } from "../../domain/services.types"

export interface RichServiceProduct {
  id: string
  product_id: string
  quantity: number
  product?: { id: string; name: string; price: unknown }
}

export interface RichService {
  id: string
  name: string
  description?: string | null
  base_price: unknown
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
  service_products?: RichServiceProduct[]
}

export function mapServiceToResponse(service: RichService): IServiceResponse {
  return {
    id: service.id,
    name: service.name,
    description: service.description || undefined,
    base_price: Number(service.base_price),
    is_active: service.is_active,
    products: (service.service_products || []).map((sp: RichServiceProduct) => ({
      id: sp.id,
      product_id: sp.product_id,
      product_name: sp.product?.name || "Unknown",
      product_price: Number(sp.product?.price || 0),
      quantity: sp.quantity,
    })),
    created_at: service.created_at instanceof Date ? service.created_at.toISOString() : service.created_at,
    updated_at: service.updated_at instanceof Date ? service.updated_at.toISOString() : service.updated_at,
  }
}