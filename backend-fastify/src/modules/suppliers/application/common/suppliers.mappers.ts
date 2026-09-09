import type { ISupplierResponse } from "../../domain/suppliers.types"

export interface RichSupplier {
  id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
  _count?: { products: number }
}

export function mapSupplierToResponse(supplier: RichSupplier): ISupplierResponse {
  return {
    id: supplier.id,
    name: supplier.name,
    contact_name: supplier.contact_name || undefined,
    email: supplier.email || undefined,
    phone: supplier.phone || undefined,
    address: supplier.address || undefined,
    notes: supplier.notes || undefined,
    is_active: supplier.is_active,
    product_count: supplier._count?.products ?? undefined,
    created_at: supplier.created_at instanceof Date ? supplier.created_at.toISOString() : supplier.created_at,
    updated_at: supplier.updated_at instanceof Date ? supplier.updated_at.toISOString() : supplier.updated_at,
  }
}