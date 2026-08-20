import { prisma } from "@/config/prisma"
import type { ICreditRepository } from "../domain/credit.interface"
import type { CreateCreditPaymentData } from "../domain/credit.entities"
import { Prisma } from "@prisma/client"

export const CreditRepository: ICreditRepository = {
  async getClientsWithDebt(params) {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit
    const filter = params?.filter || "todos"

    // Build dynamic SQL conditions
    const storeCond = params?.storeId ? `AND s.store_id = $1::text` : ""
    const searchCond = params?.search
      ? `AND (c.name ILIKE $${params.storeId ? 2 : 1}::text OR c.phone ILIKE $${params.storeId ? 2 : 1}::text)`
      : ""
    const storeArgs = params?.storeId ? [params.storeId] : []
    const searchArgs = params?.search ? [`%${params.search}%`] : []
    const paramOffset = storeArgs.length + searchArgs.length

    // Filter conditions
    let havingClause = `HAVING CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) > 0.009`
    if (filter === "saldados") {
      // Clients fully paid: total_debt <= 0 but had credit sales
      havingClause = `HAVING CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) <= 0.009 AND CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) >= -0.009`
    } else if (filter === "morosos") {
      // Clients with oldest unpaid sale > 30 days
      havingClause = `HAVING CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) > 0.009 AND MIN(s.created_at) < NOW() - INTERVAL '30 days'`
    }

    // Aggregate debt per client using raw SQL for performance
    const rows = await prisma.$queryRawUnsafe<Array<{
      client_id: string
      client_name: string
      client_phone: string | null
      total_debt: number
      sale_count: number
      oldest_pending_days: number | null
    }>>(
      `SELECT
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) as total_debt,
        COUNT(DISTINCT s.id)::int as sale_count,
        EXTRACT(DAY FROM NOW() - MIN(s.created_at))::int as oldest_pending_days
      FROM sales s
      JOIN clients c ON c.id = s.client_id
      LEFT JOIN (
        SELECT sale_id, SUM(amount) as total_paid
        FROM credit_payments
        GROUP BY sale_id
      ) paid ON paid.sale_id = s.id
      WHERE s.payment_method = 'credito'
        AND s.client_id IS NOT NULL
        AND c.deleted_at IS NULL
        ${storeCond}
        ${searchCond}
      GROUP BY c.id, c.name, c.phone
      ${havingClause}
      ORDER BY total_debt DESC
      LIMIT $${paramOffset + 1}::int OFFSET $${paramOffset + 2}::int`,
      ...storeArgs,
      ...searchArgs,
      limit,
      skip,
    )

    // Count total clients
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int as total FROM (
        SELECT c.id
        FROM sales s
        JOIN clients c ON c.id = s.client_id
        LEFT JOIN (
          SELECT sale_id, SUM(amount) as total_paid
          FROM credit_payments
          GROUP BY sale_id
        ) paid ON paid.sale_id = s.id
        WHERE s.payment_method = 'credito'
          AND s.client_id IS NOT NULL
          AND c.deleted_at IS NULL
          ${storeCond}
          ${searchCond}
        GROUP BY c.id
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
        oldest_pending_days: r.oldest_pending_days,
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

  async getTotalPending(storeId) {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT CAST(COALESCE(SUM(s.total), 0) - COALESCE(SUM(paid.total_paid), 0) AS DECIMAL(10,2)) as total
       FROM sales s
       LEFT JOIN (
         SELECT sale_id, SUM(amount) as total_paid
         FROM credit_payments
         GROUP BY sale_id
       ) paid ON paid.sale_id = s.id
       WHERE s.payment_method = 'credito'
         AND s.client_id IS NOT NULL
         ${storeId ? `AND s.store_id = $1::text` : ""}`,
      ...(storeId ? [storeId] : []),
    )

    return Number(rows[0]?.total ?? 0)
  },
}
