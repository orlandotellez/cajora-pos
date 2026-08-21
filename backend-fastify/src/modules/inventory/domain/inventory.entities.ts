export interface IInventoryMovementEntity {
  id: string
  product_id: string
  product_name?: string
  movement_type: string
  quantity: number
  unit_cost?: number | null
  unit_type?: string | null
  unit_quantity?: number | null
  note?: string
  user_id: string
  batch_id?: string
  store_id?: string
  created_at: Date
}

export type CreateMovementData = {
  product_id: string
  movement_type: "entrada" | "salida" | "ajuste"
  quantity: number
  unit_cost?: number | null
  paid_cash?: boolean
  note?: string
  batch_id?: string
  user_id: string
  store_id?: string
}
