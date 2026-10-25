import { prisma } from "@/config/prisma"
import type { ICreditRepository } from "../domain/credit.interface"
import type { CreateCreditPaymentData } from "../domain/credit.entities"
import type { ICreditSummary } from "../domain/credit.types"
import { Prisma } from "@/generated/prisma/client"

const PENDING_TOLERANCE = 0.009

function salePendingCte(storeId?: string): string {
  return `sale_pending AS (
    SELECT s.id, s.client_id, s.created_at, s.total - COALESCE(p.paid, 0) AS pending
    FROM sales s
    LEFT JOIN (
      SELECT sale_id, SUM(amount) AS paid
      FROM credit_payments
      GROUP BY sale_id
    ) p ON p.sale_id = s.id
    WHERE s.payment_method = 'credito' AND s.client_id IS NOT NULL
    ${storeId ? `AND s.store_id = $1::text` : ""}
  )`
}

async function querySummary(storeId?: string): Promise<ICreditSummary> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    total_pending: unknown
    debtors_count: unknown
    overdue_count: unknown
    credit_sales_count: unknown
  }>>(
    `WITH ${salePendingCte(storeId)},
    client_debt AS (
      SELECT sp.client_id,
        SUM(sp.pending) AS debt,
        MIN(sp.created_at) FILTER (WHERE sp.pending > ${PENDING_TOLERANCE}) AS oldest_pending,
        COUNT(*)::int AS sale_count
      FROM sale_pending sp
      GROUP BY sp.client_id
    )
    SELECT
      CAST(COALESCE(SUM(debt) FILTER (WHERE debt > ${PENDING_TOLERANCE}), 0) AS DECIMAL(12,2)) AS total_pending,
      COUNT(*) FILTER (WHERE debt > ${PENDING_TOLERANCE})::int AS debtors_count,
      COUNT(*) FILTER (WHERE debt > ${PENDING_TOLERANCE} AND oldest_pending < NOW() - INTERVAL '30 days')::int AS overdue_count,
      COALESCE(SUM(sale_count), 0)::int AS credit_sales_count
    FROM client_debt`,
    ...(storeId ? [storeId] : []),
  )

  const row = rows[0]
  return {
    total_pending: Number(row?.total_pending ?? 0),
    debtors_count: Number(row?.debtors_count ?? 0),
    overdue_count: Number(row?.overdue_count ?? 0),
    credit_sales_count: Number(row?.credit_sales_count ?? 0),
  }
}

export const CreditRepository: ICreditRepository = {
  async getClientsWithDebt(params) {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit
    const filter = params?.filter || "todos"

    const searchCond = params?.search
      ? `AND (c.name ILIKE $${params.storeId ? 2 : 1}::text OR c.phone ILIKE $${params.storeId ? 2 : 1}::text)`
      : ""
    const storeArgs = params?.storeId ? [params.storeId] : []
    const searchArgs = params?.search ? [`%${params.search}%`] : []
    const paramOffset = storeArgs.length + searchArgs.length

    let havingClause = `HAVING SUM(sp.pending) > ${PENDING_TOLERANCE}`
    if (filter === "saldados") {
      havingClause = `HAVING ABS(SUM(sp.pending)) <= ${PENDING_TOLERANCE} AND c.deleted_at IS NULL`
    } else if (filter === "morosos") {
      havingClause = `HAVING SUM(sp.pending) > ${PENDING_TOLERANCE} AND MIN(sp.created_at) FILTER (WHERE sp.pending > ${PENDING_TOLERANCE}) < NOW() - INTERVAL '30 days'`
    }

    const rows = await prisma.$queryRawUnsafe<Array<{
      client_id: string
      client_name: string
      client_phone: string | null
      client_deleted: boolean
      total_debt: unknown
      sale_count: number
      oldest_pending_days: number | null
    }>>(
      `WITH ${salePendingCte(params?.storeId)}
      SELECT
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        (c.deleted_at IS NOT NULL) as client_deleted,
        CAST(SUM(sp.pending) AS DECIMAL(12,2)) as total_debt,
        COUNT(*)::int as sale_count,
        EXTRACT(DAY FROM NOW() - MIN(sp.created_at) FILTER (WHERE sp.pending > ${PENDING_TOLERANCE}))::int as oldest_pending_days
      FROM sale_pending sp
      JOIN clients c ON c.id = sp.client_id
      WHERE 1 = 1
        ${searchCond}
      GROUP BY c.id, c.name, c.phone, c.deleted_at
      ${havingClause}
      ORDER BY total_debt DESC
      LIMIT $${paramOffset + 1}::int OFFSET $${paramOffset + 2}::int`,
      ...storeArgs,
      ...searchArgs,
      limit,
      skip,
    )

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `WITH ${salePendingCte(params?.storeId)}
      SELECT COUNT(*)::int as total FROM (
        SELECT c.id
        FROM sale_pending sp
        JOIN clients c ON c.id = sp.client_id
        WHERE 1 = 1
          ${searchCond}
        GROUP BY c.id, c.deleted_at
        ${havingClause}
      ) sub`,
      ...storeArgs,
      ...searchArgs,
    )

    return {
      clients: rows.map((r) => ({
        client_id: r.client_id,
        client_name: r.client_name,
        client_phone: r.client_phone,
        total_debt: Number(r.total_debt),
        sale_count: r.sale_count,
        client_deleted: Boolean(r.client_deleted),
        oldest_pending_days: r.oldest_pending_days ?? null,
      })),
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    }
  },

  async getClientCreditSales(clientId, storeId) {
    const sales = await prisma.sale.findMany({
      where: {
        client_id: clientId,
        payment_method: "credito",
        ...(storeId && { store_id: storeId }),
      },
      include: {
        items: { select: { product_name: true, quantity: true, line_total: true } },
        credit_payments: { select: { amount: true } },
      },
      orderBy: { created_at: "desc" },
    })

    return sales.map((s) => {
      const paid = s.credit_payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const total = Number(s.total)
      return {
        id: s.id,
        total,
        paid,
        pending: total - paid,
        created_at: s.created_at,
        items: s.items.map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          line_total: Number(i.line_total),
        })),
      }
    })
  },

  async getSalePayments(saleId) {
    const payments = await prisma.credit_payment.findMany({
      where: { sale_id: saleId },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    })

    return payments.map((p) => ({
      id: p.id,
      sale_id: p.sale_id,
      client_id: p.client_id,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      notes: p.notes ?? undefined,
      user_id: p.user_id,
      store_id: p.store_id,
      created_at: p.created_at,
    }))
  },

  async createPayment(data, userId, storeId) {
    const payment = await prisma.credit_payment.create({
      data: {
        sale_id: data.sale_id,
        client_id: data.client_id,
        amount: data.amount,
        payment_method: data.payment_method,
        notes: data.notes,
        user_id: userId,
        store_id: storeId,
      },
    })

    return {
      id: payment.id,
      sale_id: payment.sale_id,
      client_id: payment.client_id,
      amount: Number(payment.amount),
      payment_method: payment.payment_method,
      notes: payment.notes ?? undefined,
      user_id: payment.user_id,
      store_id: payment.store_id,
      created_at: payment.created_at,
    }
  },

  async getSummary(storeId) {
    return querySummary(storeId)
  },

  async getTotalPending(storeId) {
    const summary = await querySummary(storeId)
    return summary.total_pending
  },
}
