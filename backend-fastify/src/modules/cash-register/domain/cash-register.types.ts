export interface ICashSessionResponse {
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

export interface ICashStatusResponse {
  open_sessions: (ICashSessionResponse & { cash_so_far: number; expenses_total: number })[]
  can_sell_cash: boolean
}

export interface ICashHistoryResponse {
  sessions: ICashSessionResponse[]
  total: number
  page: number
  limit: number
}

export interface ICashCloseResponse {
  session: ICashSessionResponse
  report: {
    expected_amount: number
    difference: number
    expenses_total: number
  }
}
