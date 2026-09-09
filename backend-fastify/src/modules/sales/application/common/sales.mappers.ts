import type { ISaleResponse } from "../../domain/sales.types"
import type { ISaleEntity, ISaleItemEntity, ISaleServiceEntity, ISaleServiceProductEntity } from "../../domain/sales.entities"

export interface RichSaleService extends ISaleServiceEntity {
  products?: ISaleServiceProductEntity[]
}

export interface RichSale extends ISaleEntity {
  items?: ISaleItemEntity[]
  service_items?: RichSaleService[]
}

export function mapSaleToResponse(sale: RichSale): ISaleResponse {
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
    client_id: sale.client_id || undefined,
    client_name: sale.client_name,
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