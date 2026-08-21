import type { CreateCashSessionData, CloseCashSessionData, CreateCashExpenseData, ICashSessionEntity } from "./cash-register.entities"
import type { ICashSessionResponse } from "./cash-register.types"

export interface ICashSessionWithLive {
  session: ICashSessionResponse
  cash_so_far: number
  expenses_total: number
}

export interface ICashCloseResult {
  session: ICashSessionEntity
  report: {
    expected_amount: number
    difference: number
    expenses_total: number
  }
}

export interface ICashRegisterRepository {
  getUserName(userId: string): Promise<string | null>

  findOpenByUser(userId: string, storeId: string): Promise<ICashSessionEntity | null>

  countOpenByStore(storeId: string): Promise<number>

  create(data: CreateCashSessionData): Promise<ICashSessionEntity>

  findById(sessionId: string, storeId: string): Promise<ICashSessionEntity | null>

  listOpen(storeId: string): Promise<ICashSessionEntity[]>

  listHistory(params: { storeId: string; page: number; limit: number }): Promise<{
    sessions: ICashSessionEntity[]
    total: number
    page: number
    limit: number
  }>

  getCashIn(params: { store_id: string; session_id: string; user_id: string; from: Date; to: Date }): Promise<number>

  getExpensesTotal(params: { session_id: string }): Promise<number>

  createExpense(data: CreateCashExpenseData): Promise<void>

  closeWithArqueo(data: CloseCashSessionData): Promise<ICashCloseResult>
}
