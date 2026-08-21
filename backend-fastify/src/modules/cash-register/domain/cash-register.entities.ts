export interface ICashSessionEntity {
  id: string
  store_id: string
  user_id: string
  user_name: string
  label?: string | null
  status: string // "abierto" | "cerrado"
  opening_amount: number
  closing_amount_counted?: number | null
  expected_amount?: number | null
  difference?: number | null
  observations?: string | null
  opened_at: Date
  closed_at?: Date | null
}

export interface CreateCashSessionData {
  store_id: string
  user_id: string
  user_name: string
  label?: string
  opening_amount: number
}

export interface CloseCashSessionData {
  session_id: string
  store_id: string
  monto_contado: number
  observaciones?: string
}

export interface CreateCashExpenseData {
  session_id: string
  store_id: string
  user_id: string
  amount: number
  reason: string
  source_type?: string
  ref_id?: string
  description?: string
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function computeArqueo(
  opening_amount: number,
  cash_in: number,
  monto_contado: number,
  expenses = 0
): { expected_amount: number; difference: number } {
  const expected_amount = round2(opening_amount + cash_in - expenses)
  return { expected_amount, difference: round2(monto_contado - expected_amount) }
}
