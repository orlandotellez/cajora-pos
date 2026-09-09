import type { IBatchResponse } from "../../domain/batch-inventory.types"

export interface RichBatchItem {
  id: string
  product_id: string
  quantity: number
  unit_cost?: unknown
  notes?: string | null
  product?: { name: string }
}

export interface RichBatch {
  id: string
  movement_type: string
  supplier_id?: string | null
  notes?: string | null
  user_id: string
  created_at: Date
  items?: RichBatchItem[]
  supplier?: { name: string } | null
  user?: { name: string } | null
}

export function mapBatchToResponse(batch: RichBatch): IBatchResponse {
  const items = (batch.items || []).map((item: RichBatchItem) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name,
    quantity: item.quantity,
    unit_cost: item.unit_cost ? Number(item.unit_cost) : null,
    notes: item.notes || null,
  }))

  const total_items = items.length
  const total_quantity = items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)

  return {
    id: batch.id,
    movement_type: batch.movement_type,
    supplier_id: batch.supplier_id || null,
    supplier_name: batch.supplier?.name,
    notes: batch.notes || null,
    user_id: batch.user_id,
    user_name: batch.user?.name,
    items,
    total_items,
    total_quantity,
    created_at: batch.created_at instanceof Date ? batch.created_at.toISOString() : batch.created_at,
  }
}