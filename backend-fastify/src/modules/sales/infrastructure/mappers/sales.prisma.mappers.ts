import type { ISaleEntity, ISaleItemEntity, ISaleServiceEntity, ISaleServiceProductEntity } from "../../domain/sales.entities"
import type { sale, sale_item, sale_service, sale_service_product } from "@prisma/client"

type SaleWithRelations = sale & {
  items?: sale_item[]
  service_items?: (sale_service & { products?: sale_service_product[] })[]
}

export function mapPrismaSaleToEntity(sale: SaleWithRelations): ISaleEntity {
  return {
    id: sale.id,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    payment_method: sale.payment_method,
    amount_received: sale.amount_received || undefined,
    change_given: sale.change_given || undefined,
    user_id: sale.user_id,
    created_at: sale.created_at,
    updated_at: sale.updated_at,
    items: sale.items?.map(mapPrismaSaleItemToEntity),
    service_items: sale.service_items?.map(mapPrismaSaleServiceToEntity),
  }
}

export function mapPrismaSaleItemToEntity(item: sale_item): ISaleItemEntity {
  return {
    id: item.id,
    sale_id: item.sale_id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

export function mapPrismaSaleServiceToEntity(si: sale_service & { products?: sale_service_product[] }): ISaleServiceEntity {
  return {
    id: si.id,
    sale_id: si.sale_id,
    service_id: si.service_id,
    service_name: si.service_name,
    base_price: si.base_price,
    line_total: si.line_total,
    created_at: si.created_at,
    products: si.products?.map(mapPrismaSaleServiceProductToEntity),
  }
}

export function mapPrismaSaleServiceProductToEntity(sp: sale_service_product): ISaleServiceProductEntity {
  return {
    id: sp.id,
    sale_service_id: sp.sale_service_id,
    product_id: sp.product_id,
    product_name: sp.product_name,
    quantity: sp.quantity,
    unit_price: sp.unit_price,
    line_total: sp.line_total,
    affects_price: sp.affects_price,
    created_at: sp.created_at,
  }
}
