import { BadRequestError, NotFoundError } from "@/core/errors/AppError"
import type { ICreditRepository } from "../domain/credit.interface"
import type { CreateCreditPaymentData } from "../domain/credit.entities"
import type { IClientsWithDebtResponse, IClientDebtResponse, ICreditPaymentResponse } from "../domain/credit.types"
import { prisma } from "@/config/prisma"

export const createCreditService = (repository: ICreditRepository) => ({
  getClientsWithDebt: async (params?: { search?: string; page?: number; limit?: number; storeId?: string; filter?: "todos" | "morosos" | "saldados" }): Promise<IClientsWithDebtResponse> => {
    return repository.getClientsWithDebt(params)
  },

  getClientDebt: async (clientId: string, storeId?: string): Promise<IClientDebtResponse> => {
    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id: clientId, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: { id: true, name: true, phone: true },
    })
    if (!client) throw new NotFoundError("Cliente no encontrado")

    const [sales, totalDebt] = await Promise.all([
      repository.getClientCreditSales(clientId, storeId),
      repository.getClientsWithDebt({ storeId }),
    ])

    const clientSummary = totalDebt.clients.find((c) => c.client_id === clientId)

    // Get all payments for this client's credit sales
    const allPayments: ICreditPaymentResponse[] = []
    for (const sale of sales) {
      if (sale.paid > 0) {
        const payments = await repository.getSalePayments(sale.id)
        allPayments.push(...payments.map((p) => ({
          id: p.id,
          sale_id: p.sale_id,
          client_id: p.client_id,
          amount: p.amount,
          payment_method: p.payment_method,
          notes: p.notes,
          user_name: "", // will be filled below
          created_at: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
        })))
      }
    }

    // Fetch user names for payments
    if (allPayments.length > 0) {
      const userIds = [...new Set(allPayments.map((p) => p.sale_id))]
      const paymentDetails = await prisma.credit_payment.findMany({
        where: { sale_id: { in: userIds } },
        include: { user: { select: { name: true } } },
      })
      const userNameMap = new Map(paymentDetails.map((pd) => [pd.id, pd.user.name]))
      for (const p of allPayments) {
        p.user_name = userNameMap.get(p.id) || ""
      }
    }

    return {
      client: {
        client_id: client.id,
        client_name: client.name,
        client_phone: client.phone ?? undefined,
        total_debt: clientSummary?.total_debt ?? 0,
        sale_count: clientSummary?.sale_count ?? 0,
      },
      sales: sales.filter((s) => s.pending > 0.009).map((s) => ({
        id: s.id,
        total: s.total,
        paid: s.paid,
        pending: s.pending,
        created_at: s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at),
        items: s.items,
      })),
      payments: allPayments,
    }
  },

  registerPayment: async (data: CreateCreditPaymentData, userId: string, storeId: string): Promise<ICreditPaymentResponse> => {
    // Validate sale exists and is credit
    const sale = await prisma.sale.findFirst({
      where: { id: data.sale_id, store_id: storeId },
      select: { id: true, payment_method: true, total: true, client_id: true },
    })
    if (!sale) throw new NotFoundError("Venta no encontrada")
    if (sale.payment_method !== "credito") throw new BadRequestError("Esta venta no es a crédito")
    if (sale.client_id !== data.client_id) throw new BadRequestError("El cliente no coincide con la venta")

    // Validate amount doesn't exceed pending
    const existingPayments = await prisma.credit_payment.aggregate({
      where: { sale_id: data.sale_id },
      _sum: { amount: true },
    })
    const totalPaid = Number(existingPayments._sum.amount ?? 0)
    const pending = Number(sale.total) - totalPaid

    if (data.amount <= 0) throw new BadRequestError("El monto debe ser mayor a 0")
    if (data.amount > pending + 0.009) throw new BadRequestError(`El monto excede el saldo pendiente de C$ ${pending.toFixed(2)}`)

    const payment = await repository.createPayment(data, userId, storeId)

    return {
      id: payment.id,
      sale_id: payment.sale_id,
      client_id: payment.client_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      notes: payment.notes,
      user_name: "",
      created_at: payment.created_at instanceof Date ? payment.created_at.toISOString() : String(payment.created_at),
    }
  },

  getTotalPending: async (storeId: string): Promise<number> => {
    return repository.getTotalPending(storeId)
  },
})
