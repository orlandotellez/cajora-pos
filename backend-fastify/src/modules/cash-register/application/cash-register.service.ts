import type { ICashRegisterRepository, ICashSessionWithLive, ICashCloseResult } from "../domain/cash-register.interface"
import type { CreateCashSessionData, CloseCashSessionData, CreateCashExpenseData, ICashSessionEntity } from "../domain/cash-register.entities"
import { round2 } from "../domain/cash-register.entities"
import type { ICashSessionResponse, ICashCloseResponse } from "../domain/cash-register.types"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/core/errors/AppError"

/** Round to 2 decimals handled by domain helper (round2) */

function mapSession(s: ICashSessionEntity): ICashSessionResponse {
  return {
    id: s.id,
    store_id: s.store_id,
    user_id: s.user_id,
    user_name: s.user_name,
    label: s.label ?? undefined,
    status: s.status as "abierto" | "cerrado",
    opening_amount: Number(s.opening_amount),
    closing_amount_counted: s.closing_amount_counted != null ? Number(s.closing_amount_counted) : undefined,
    expected_amount: s.expected_amount != null ? Number(s.expected_amount) : undefined,
    difference: s.difference != null ? Number(s.difference) : undefined,
    observations: s.observations ?? undefined,
    opened_at: s.opened_at instanceof Date ? s.opened_at.toISOString() : String(s.opened_at),
    closed_at: s.closed_at ? (s.closed_at instanceof Date ? s.closed_at.toISOString() : String(s.closed_at)) : undefined,
  }
}

export const createCashRegisterService = (repository: ICashRegisterRepository) => ({
  open: async (
    data: { monto_inicial: number; label?: string },
    userId: string,
    storeId: string
  ): Promise<ICashSessionResponse> => {
    if (data.monto_inicial < 0) throw new BadRequestError("El monto inicial no puede ser negativo")

    const existing = await repository.findOpenByUser(userId, storeId)
    if (existing) throw new ConflictError("Ya tenés una caja abierta. Cerrala antes de abrir otra")

    const userName = await repository.getUserName(userId)
    if (!userName) throw new NotFoundError("Usuario no encontrado")

    const payload: CreateCashSessionData = {
      store_id: storeId,
      user_id: userId,
      user_name: userName,
      ...(data.label && { label: data.label }),
      opening_amount: round2(data.monto_inicial),
    }
    const session = await repository.create(payload)
    return mapSession(session)
  },

  close: async (
    data: CloseCashSessionData,
    userId: string,
    role: string | undefined,
    storeId: string
  ): Promise<ICashCloseResponse> => {
    if (data.monto_contado < 0) throw new BadRequestError("El monto contado no puede ser negativo")

    const session = await repository.findById(data.session_id, storeId)
    if (!session) throw new NotFoundError("Caja no encontrada")
    if (session.status === "cerrado") throw new ConflictError("La caja ya está cerrada")
    // Only the cashier who opened it (or an admin) can close it
    if (session.user_id !== userId && role !== "admin") {
      throw new ForbiddenError("Solo el responsable de la caja o un admin puede cerrarla")
    }

    const result = await repository.closeWithArqueo({
      session_id: session.id,
      store_id: storeId,
      monto_contado: round2(data.monto_contado),
      ...(data.observaciones && { observaciones: data.observaciones }),
    })

    return {
      session: mapSession(result.session),
      report: result.report,
    }
  },
  status: async (storeId: string, userId?: string, role?: string): Promise<{ open_sessions: ICashSessionWithLive[]; can_sell_cash: boolean }> => {
    const isAdmin = role === "admin" || role === "super_admin"
    const sessions = isAdmin
      ? await repository.listOpen(storeId)
      : await repository.listOpenByUser(userId!, storeId)
    const now = new Date()
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const params = {
          store_id: storeId,
          session_id: s.id,
          user_id: s.user_id,
          from: s.opened_at,
          to: now,
        }
        const [cashIn, expensesTotal] = await Promise.all([
          repository.getCashIn(params),
          repository.getExpensesTotal({ session_id: s.id }),
        ])
        return {
          session: mapSession(s),
          cash_so_far: round2(cashIn),
          expenses_total: round2(expensesTotal),
        }
      })
    )
    return {
      open_sessions: enriched,
      can_sell_cash: enriched.length > 0,
    }
  },

  /**
   * Resuelve qué sesión de caja absorbe un gasto pagado en efectivo:
   * 1. la sesión abierta del propio usuario;
   * 2. si no tiene, la única sesión abierta de la tienda;
   * 3. cero sesiones → ConflictError (no hay caja de donde salir el dinero);
   *    varias sin sesión propia → ConflictError (atribución ambigua).
   */
  resolveExpenseSession: async (params: { storeId: string; userId: string }): Promise<{ session_id: string }> => {
    const own = await repository.findOpenByUser(params.userId, params.storeId)
    if (own) return { session_id: own.id }

    const open = await repository.listOpen(params.storeId)
    if (open.length === 0) {
      throw new ConflictError("No hay una caja abierta. Abrí la caja para registrar gastos en efectivo")
    }
    if (open.length > 1) {
      throw new ConflictError("Hay varias cajas abiertas: abrí tu propia caja para registrar gastos en efectivo")
    }
    return { session_id: open[0]!.id }
  },

  /** Registra una salida de efectivo ligada a una sesión abierta */
  registerExpense: async (data: CreateCashExpenseData): Promise<void> => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestError("El monto del gasto debe ser mayor a cero")
    }
    await repository.createExpense({
      ...data,
      amount: round2(data.amount),
    })
  },

  history: async (params?: { page?: number; limit?: number; storeId?: string; userId?: string; role?: string }) => {
    const isAdmin = params?.role === "admin" || params?.role === "super_admin"
    const result = await repository.listHistory({
      storeId: params?.storeId!,
      userId: isAdmin ? undefined : params?.userId,
      page: params?.page || 1,
      limit: params?.limit || 20,
    })
    return {
      sessions: result.sessions.map(mapSession),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },
})
