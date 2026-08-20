import type { ICreditPaymentEntity, CreateCreditPaymentData } from "./credit.entities"

export interface ICreditRepository {
  /** List clients with outstanding credit balance */
  getClientsWithDebt(params?: { search?: string; page?: number; limit?: number; storeId?: string; filter?: "todos" | "morosos" | "saldados" }): Promise<{
    clients: {
      client_id: string
      client_name: string
      client_phone?: string | null
      total_debt: number
      sale_count: number
      oldest_pending_days?: number | null
    }[]
    total: number
    page: number
    limit: number
  }>

  /** Get credit sales for a specific client */
  getClientCreditSales(clientId: string, storeId?: string): Promise<{
    id: string
    total: number
    paid: number
    pending: number
    created_at: Date
    items: { name: string; quantity: number; line_total: number }[]
  }[]>

  /** Get payment history for a specific sale */
  getSalePayments(saleId: string): Promise<ICreditPaymentEntity[]>

  /** Register a partial payment */
  createPayment(data: CreateCreditPaymentData, userId: string, storeId: string): Promise<ICreditPaymentEntity>

  /** Get total outstanding across all clients */
  getTotalPending(storeId: string): Promise<number>
}
