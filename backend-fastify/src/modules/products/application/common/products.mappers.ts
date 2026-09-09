import type { IProductResponse } from "../../domain/products.types"
import type { IProductEntity } from "../../domain/products.entities"

export interface RichProductEntity extends IProductEntity {
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
}

export function mapProductToResponse(product: RichProductEntity): IProductResponse {
  return {
    id: product.id,
    barcode: product.barcode || undefined,
    name: product.name,
    unit_type: product.unit_type || undefined,
    unit_quantity: product.unit_quantity ?? undefined,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : undefined,
    supplier: product.supplier
      ? { id: product.supplier.id, name: product.supplier.name }
      : undefined,
    price: Number(product.price),
    cost: Number(product.cost),
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    active: product.active,
    created_at: product.created_at instanceof Date ? product.created_at.toISOString() : product.created_at,
    updated_at: product.updated_at instanceof Date ? product.updated_at.toISOString() : product.updated_at,
  }
}