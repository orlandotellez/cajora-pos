import { api } from "./client"

export interface ClientDebtSummary {
  client_id: string
  client_name: string
  client_phone?: string | null
  total_debt: number
  sale_count: number
  oldest_pending_days?: number | null
}

export interface CreditSaleDetail {
  id: string
  total: number
  paid: number
  pending: number
  created_at: string
  items: { name: string; quantity: number; line_total: number }[]
}

export interface CreditPayment {
  id: string
  sale_id: string
  client_id: string
  amount: number
  payment_method: string
  notes?: string
  user_name: string
  created_at: string
}

export interface ClientDebtResponse {
  client: ClientDebtSummary
  sales: CreditSaleDetail[]
  payments: CreditPayment[]
}

export interface ClientsWithDebtResponse {
  clients: ClientDebtSummary[]
  total: number
  page: number
  limit: number
}

export interface RegisterPaymentPayload {
  sale_id: string
  client_id: string
  amount: number
  payment_method: string
  notes?: string
}

export const creditsApi = {
  list: (params?: { search?: string; page?: number; limit?: number; filter?: "todos" | "morosos" | "saldados" }) =>
    api.get<ClientsWithDebtResponse>(
      "/credits",
      params as Record<string, string | number | undefined>,
    ),

  getTotal: () => api.get<{ total: number }>("/credits/total"),

  getClientDebt: (clientId: string) =>
    api.get<ClientDebtResponse>(`/credits/${clientId}`),

  registerPayment: (data: RegisterPaymentPayload) =>
    api.post<CreditPayment>("/credits/payments", data),
}
