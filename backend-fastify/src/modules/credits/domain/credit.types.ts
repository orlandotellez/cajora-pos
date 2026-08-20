export interface ICreditPaymentResponse {
  id: string
  sale_id: string
  client_id: string
  amount: number
  payment_method: string
  notes?: string
  user_name: string
  created_at: string
}

export interface IClientDebtSummary {
  client_id: string
  client_name: string
  client_phone?: string | null
  total_debt: number
  sale_count: number
}

export interface ICreditSaleDetail {
  id: string
  total: number
  paid: number
  pending: number
  created_at: string
  items: { name: string; quantity: number; line_total: number }[]
}

export interface IClientDebtResponse {
  client: IClientDebtSummary
  sales: ICreditSaleDetail[]
  payments: ICreditPaymentResponse[]
}

export interface IClientsWithDebtResponse {
  clients: IClientDebtSummary[]
  total: number
  page: number
  limit: number
}
