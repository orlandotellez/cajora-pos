import { prisma } from "@/config/prisma"
import type { PrismaClient } from "@prisma/client"
import { ConflictError, NotFoundError } from "@/core/errors/AppError"
import type { ICashRegisterRepository, ICashCloseResult } from "../domain/cash-register.interface"
import type { CreateCashSessionData, CloseCashSessionData, CreateCashExpenseData, ICashSessionEntity } from "../domain/cash-register.entities"
import { computeArqueo, round2 } from "../domain/cash-register.entities"

type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

function mapRow(s: {
  id: string
  store_id: string
  user_id: string
  user_name: string
  label: string | null
  status: string
  opening_amount: unknown
  closing_amount_counted: unknown
  expected_amount: unknown
  difference: unknown
  observations: string | null
  opened_at: Date
  closed_at: Date | null
}): ICashSessionEntity {
  return {
    id: s.id,
    store_id: s.store_id,
    user_id: s.user_id,
    user_name: s.user_name,
    label: s.label,
    status: s.status,
    opening_amount: Number(s.opening_amount),
    closing_amount_counted: s.closing_amount_counted != null ? Number(s.closing_amount_counted) : null,
    expected_amount: s.expected_amount != null ? Number(s.expected_amount) : null,
    difference: s.difference != null ? Number(s.difference) : null,
    observations: s.observations,
    opened_at: s.opened_at,
    closed_at: s.closed_at,
  }
}

export const CashRegisterRepository: ICashRegisterRepository = {
  async getUserName(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, deleted_at: true },
    })
    if (!user || user.deleted_at) return null
    return user.name
  },

  async findOpenByUser(userId, storeId) {
    const session = await prisma.cash_session.findFirst({
      where: { user_id: userId, store_id: storeId, status: "abierto", deleted_at: null },
      orderBy: { opened_at: "desc" },
    })
    return session ? mapRow(session) : null
  },

  async countOpenByStore(storeId) {
    return prisma.cash_session.count({
      where: { store_id: storeId, status: "abierto", deleted_at: null },
    })
  },

  async create(data: CreateCashSessionData) {
    const session = await prisma.cash_session.create({
      data: {
        store_id: data.store_id,
        user_id: data.user_id,
        user_name: data.user_name,
        ...(data.label && { label: data.label }),
        opening_amount: data.opening_amount,
        status: "abierto",
      },
    })
    return mapRow(session)
  },

  async findById(sessionId, storeId) {
    const session = await prisma.cash_session.findFirst({
      where: { id: sessionId, store_id: storeId, deleted_at: null },
    })
    return session ? mapRow(session) : null
  },

  async listOpen(storeId) {
    const sessions = await prisma.cash_session.findMany({
      where: { store_id: storeId, status: "abierto", deleted_at: null },
      orderBy: { opened_at: "asc" },
    })
    return sessions.map(mapRow)
  },

  async listHistory({ storeId, page, limit }) {
    const skip = (page - 1) * limit
    const [sessions, total] = await Promise.all([
      prisma.cash_session.findMany({
        where: { store_id: storeId, deleted_at: null },
        orderBy: { opened_at: "desc" },
        take: limit,
        skip,
      }),
      prisma.cash_session.count({ where: { store_id: storeId, deleted_at: null } }),
    ])
    return { sessions: sessions.map(mapRow), total, page, limit }
  },

  async getCashIn({ store_id, session_id, user_id, from, to }) {
    const rows = await prisma.$queryRawUnsafe<Array<{ sales_cash: string | null; credit_cash: string | null }>>(
      `SELECT
        COALESCE((
          SELECT SUM(s.total) FROM sales s
          WHERE s.store_id = $1::text
            AND s.payment_method = 'efectivo'
            AND s.created_at >= $2 AND s.created_at <= $3
            AND (s.cash_session_id = $4::text OR (s.cash_session_id IS NULL AND s.user_id = $5::text))
        ), 0) AS sales_cash,
        COALESCE((
          SELECT SUM(cp.amount) FROM credit_payments cp
          JOIN sales s2 ON s2.id = cp.sale_id
          WHERE cp.store_id = $1::text
            AND cp.payment_method = 'efectivo'
            AND cp.created_at >= $2 AND cp.created_at <= $3
            AND (s2.cash_session_id = $4::text OR (s2.cash_session_id IS NULL AND cp.user_id = $5::text))
        ), 0) AS credit_cash`,
      store_id,
      from,
      to,
      session_id,
      user_id,
    )
    const r = rows[0]
    return Number(r?.sales_cash ?? 0) + Number(r?.credit_cash ?? 0)
  },

  async getExpensesTotal({ session_id }) {
    const result = await prisma.cash_expense.aggregate({
      where: { session_id, deleted_at: null },
      _sum: { amount: true },
    })
    return round2(Number(result._sum.amount ?? 0))
  },

  async createExpense(data: CreateCashExpenseData) {
    if (data.amount <= 0) throw new ConflictError("El monto del gasto debe ser mayor a cero")

    await prisma.$transaction(async (tx) => {
      const session = await tx.cash_session.findUnique({
        where: { id: data.session_id },
        select: { status: true },
      })
      if (!session) throw new NotFoundError("Caja no encontrada")
      if (session.status !== "abierto") throw new ConflictError("La caja ya está cerrada")

      const userName = await CashRegisterRepository.getUserName(data.user_id)
      if (!userName) throw new NotFoundError("Usuario no encontrado")

      await tx.cash_expense.create({
        data: {
          session_id: data.session_id,
          amount: round2(data.amount),
          reason: data.reason,
          description: data.description,
          source_type: data.source_type,
          ref_id: data.ref_id,
          user_id: data.user_id,
          user_name: userName,
          store_id: data.store_id,
        },
      })
    })
  },

  async closeWithArqueo(data: CloseCashSessionData): Promise<ICashCloseResult> {
    const closedAt = new Date()
    const result = await prisma.$transaction(async (tx: DbClient) => {
      const fresh = await tx.cash_session.findUniqueOrThrow({
        where: { id: data.session_id },
      })
      if (fresh.status !== "abierto") throw new ConflictError("La caja ya está cerrada")

      const cashIn = await CashRegisterRepository.getCashIn({
        store_id: data.store_id,
        session_id: data.session_id,
        user_id: fresh.user_id,
        from: fresh.opened_at,
        to: closedAt,
      })

      const expensesTotal = await CashRegisterRepository.getExpensesTotal({
        session_id: data.session_id,
      })

      const expected = computeArqueo(Number(fresh.opening_amount), cashIn, data.monto_contado, expensesTotal)
      const { expected_amount, difference } = expected

      const updated = await tx.cash_session.updateMany({
        where: { id: data.session_id, status: "abierto" },
        data: {
          status: "cerrado",
          closed_at: closedAt,
          closing_amount_counted: data.monto_contado,
          expected_amount,
          difference,
          ...(data.observaciones && { observations: data.observaciones }),
        },
      })
      if (updated.count === 0) throw new ConflictError("La caja ya está cerrada")

      const session = await tx.cash_session.findUniqueOrThrow({ where: { id: data.session_id } })
      return { session: mapRow(session), report: { expected_amount, difference, expenses_total: expensesTotal } }
    })
    return result
  },
}
