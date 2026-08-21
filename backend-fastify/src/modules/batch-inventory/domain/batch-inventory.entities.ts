export interface IBatchItemEntity {
  id: string
  batch_id: string
  product_id: string
  quantity: number
  unit_cost?: number | null
  notes?: string | null
  created_at: Date
}

export interface IBatchEntity {
  id: string
  movement_type: string
  supplier_id?: string | null
  notes?: string | null
  user_id: string
  store_id?: string
  created_at: Date
  items?: IBatchItemEntity[]
}

export type CreateBatchItemData = {
  product_id: string
  quantity: number
  unit_cost?: number | null
  notes?: string | null
}

export type CreateBatchData = {
  movement_type: "entrada" | "salida" | "ajuste"
  supplier_id?: string | null
  notes?: string | null
  paid_cash?: boolean
  user_id: string
  store_id?: string
  items: CreateBatchItemData[]
}
