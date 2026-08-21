import { api } from "./client"

export interface CashSession {
  id: string
  store_id: string
  user_id: string
  user_name: string
  label?: string
  status: "abierto" | "cerrado"
  opening_amount: number
  closing_amount_counted?: number
  expected_amount?: number
  difference?: number
  observations?: string
  opened_at: string
  closed_at?: string
}

export interface OpenCashSession {
  session: CashSession
  cash_so_far: number
  expenses_total: number
}

export interface CashStatusResponse {
  open_sessions: OpenCashSession[]
  can_sell_cash: boolean
}

export interface CashHistoryResponse {
  sessions: CashSession[]
  total: number
  page: number
  limit: number
}

export interface CashCloseReportResponse {
  session: CashSession
  report: {
    expected_amount: number
    difference: number
    expenses_total: number
  }
}

export interface OpenCashPayload {
  monto_inicial: number
  label?: string
}

export interface CloseCashPayload {
  session_id: string
  monto_contado: number
  observaciones?: string
}

export const cashRegisterApi = {
  open: (data: OpenCashPayload) => api.post<CashSession>("/cash-register/open", data),

  close: (data: CloseCashPayload) => api.post<CashCloseReportResponse>("/cash-register/close", data),

  status: () => api.get<CashStatusResponse>("/cash-register/status"),

  history: (params?: { page?: number; limit?: number }) =>
    api.get<CashHistoryResponse>(
      "/cash-register/history",
      params as Record<string, string | number | undefined>,
    ),
}
