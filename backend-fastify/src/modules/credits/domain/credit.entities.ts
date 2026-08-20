export interface ICreditPaymentEntity {
  id: string
  sale_id: string
  client_id: string
  amount: number
  payment_method: string
  notes?: string
  user_id: string
  store_id: string
  created_at: Date
}

export type CreateCreditPaymentData = {
  sale_id: string
  client_id: string
  amount: number
  payment_method: string
  notes?: string
}
