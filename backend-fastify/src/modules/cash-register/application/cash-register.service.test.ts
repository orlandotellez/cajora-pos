import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createCashRegisterService } from "./cash-register.service"
import { computeArqueo } from "../domain/cash-register.entities"
import type { ICashRegisterRepository, ICashCloseResult } from "../domain/cash-register.interface"
import type { CreateCashSessionData, CloseCashSessionData, CreateCashExpenseData, ICashSessionEntity } from "../domain/cash-register.entities"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/core/errors/AppError"

function makeSession(overrides: Partial<ICashSessionEntity> = {}): ICashSessionEntity {
  return {
    id: "session-1",
    store_id: "store-1",
    user_id: "user-1",
    user_name: "María",
    label: null,
    status: "abierto",
    opening_amount: 200,
    closing_amount_counted: null,
    expected_amount: null,
    difference: null,
    observations: null,
    opened_at: new Date("2026-08-20T09:00:00Z"),
    closed_at: null,
    ...overrides,
  }
}

function makeFakeRepo(overrides: Partial<ICashRegisterRepository> = {}): ICashRegisterRepository {
  return {
    getUserName: async () => "María",
    findOpenByUser: async () => null,
    countOpenByStore: async () => 0,
    create: async (data: CreateCashSessionData) =>
      makeSession({
        id: "new-session",
        store_id: data.store_id,
        user_id: data.user_id,
        user_name: data.user_name,
        label: data.label ?? null,
        opening_amount: data.opening_amount,
      }),
    findById: async () => makeSession(),
    listOpen: async () => [],
    listHistory: async ({ page, limit }) => ({ sessions: [], total: 0, page, limit }),
    getCashIn: async () => 0,
    getExpensesTotal: async () => 0,
    createExpense: async (_data: CreateCashExpenseData) => {},
    closeWithArqueo: async (data: CloseCashSessionData): Promise<ICashCloseResult> => ({
      session: makeSession({ status: "cerrado", closing_amount_counted: data.monto_contado, expected_amount: 1500, difference: -30, closed_at: new Date() }),
      report: { expected_amount: 1500, difference: -30, expenses_total: 0 },
    }),
    ...overrides,
  }
}

describe("cash-register service", () => {
  describe("open", () => {
    it("abre caja cuando el usuario no tiene sesión abierta", async () => {
      const repo = makeFakeRepo()
      const service = createCashRegisterService(repo)

      const session = await service.open({ monto_inicial: 200 }, "user-1", "store-1")

      assert.equal(session.status, "abierto")
      assert.equal(session.user_name, "María")
      assert.equal(session.opening_amount, 200)
    })

    it("rechaza si el usuario ya tiene una caja abierta", async () => {
      const repo = makeFakeRepo({ findOpenByUser: async () => makeSession() })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.open({ monto_inicial: 100 }, "user-1", "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })

    it("rechaza monto inicial negativo", async () => {
      const service = createCashRegisterService(makeFakeRepo())

      await assert.rejects(
        () => service.open({ monto_inicial: -1 }, "user-1", "store-1"),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("rechaza usuario inexistente", async () => {
      const repo = makeFakeRepo({ getUserName: async () => null })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.open({ monto_inicial: 100 }, "ghost", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("close", () => {
    it("cierra la caja con arqueo (owner)", async () => {
      let captured: CloseCashSessionData | undefined
      const repo = makeFakeRepo({
        closeWithArqueo: async (data) => {
          captured = data
          return {
            session: makeSession({ status: "cerrado", closing_amount_counted: data.monto_contado }),
            report: { expected_amount: 1500, difference: -30, expenses_total: 200 },
          }
        },
      })
      const service = createCashRegisterService(repo)

      const result = await service.close(
        { session_id: "session-1", store_id: "store-1", monto_contado: 1470 },
        "user-1",
        "cajero",
        "store-1"
      )

      assert.equal(result.report.expected_amount, 1500)
      assert.equal(result.report.difference, -30)
      assert.equal(captured?.monto_contado, 1470)
    })

    it("rechaza cierre de caja ajena siendo cajero", async () => {
      const repo = makeFakeRepo({ findById: async () => makeSession({ user_id: "otro-user" }) })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.close({ session_id: "session-1", store_id: "store-1", monto_contado: 100 }, "user-2", "cajero", "store-1"),
        (err: unknown) => err instanceof ForbiddenError
      )
    })

    it("permite cierre de caja ajena siendo admin", async () => {
      const repo = makeFakeRepo({ findById: async () => makeSession({ user_id: "otro-user" }) })
      const service = createCashRegisterService(repo)

      const result = await service.close(
        { session_id: "session-1", store_id: "store-1", monto_contado: 1470 },
        "admin-1",
        "admin",
        "store-1"
      )
      assert.equal(result.session.status, "cerrado")
    })

    it("rechaza cerrar una caja ya cerrada", async () => {
      const repo = makeFakeRepo({ findById: async () => makeSession({ status: "cerrado" }) })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.close({ session_id: "session-1", store_id: "store-1", monto_contado: 100 }, "user-1", "cajero", "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })

    it("rechaza monto contado negativo", async () => {
      const service = createCashRegisterService(makeFakeRepo())

      await assert.rejects(
        () => service.close({ session_id: "session-1", store_id: "store-1", monto_contado: -5 }, "user-1", "cajero", "store-1"),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("rechaja caja inexistente en la tienda", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.close({ session_id: "no-existe", store_id: "store-1", monto_contado: 100 }, "user-1", "cajero", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("status", () => {
    it("can_sell_cash false cuando no hay cajas abiertas", async () => {
      const service = createCashRegisterService(makeFakeRepo())
      const result = await service.status("store-1")
      assert.equal(result.can_sell_cash, false)
      assert.deepEqual(result.open_sessions, [])
    })

    it("can_sell_cash true y cash_so_far correcto con caja abierta", async () => {
      const repo = makeFakeRepo({
        listOpen: async () => [makeSession()],
        getCashIn: async () => 1280.5,
        getExpensesTotal: async () => 300,
      })
      const service = createCashRegisterService(repo)

      const result = await service.status("store-1")
      assert.equal(result.can_sell_cash, true)
      assert.equal(result.open_sessions.length, 1)
      assert.equal(result.open_sessions[0].cash_so_far, 1280.5)
      assert.equal(result.open_sessions[0].expenses_total, 300)
    })
  })

  describe("resolveExpenseSession", () => {
    it("usa la sesión propia del usuario si tiene una abierta", async () => {
      const repo = makeFakeRepo({ findOpenByUser: async () => makeSession({ id: "mia" }) })
      const service = createCashRegisterService(repo)

      const result = await service.resolveExpenseSession({ storeId: "store-1", userId: "user-1" })
      assert.equal(result.session_id, "mia")
    })

    it("usa la única sesión de la tienda si el usuario no tiene propia", async () => {
      const repo = makeFakeRepo({
        listOpen: async () => [makeSession({ id: "unica", user_id: "otro" })],
      })
      const service = createCashRegisterService(repo)

      const result = await service.resolveExpenseSession({ storeId: "store-1", userId: "user-1" })
      assert.equal(result.session_id, "unica")
    })

    it("rechaza si no hay ninguna caja abierta", async () => {
      const service = createCashRegisterService(makeFakeRepo())

      await assert.rejects(
        () => service.resolveExpenseSession({ storeId: "store-1", userId: "user-1" }),
        (err: unknown) => err instanceof ConflictError
      )
    })

    it("rechaza si hay varias cajas abiertas y ninguna es del usuario", async () => {
      const repo = makeFakeRepo({
        listOpen: async () => [makeSession({ id: "a", user_id: "u2" }), makeSession({ id: "b", user_id: "u3" })],
      })
      const service = createCashRegisterService(repo)

      await assert.rejects(
        () => service.resolveExpenseSession({ storeId: "store-1", userId: "user-1" }),
        (err: unknown) => err instanceof ConflictError
      )
    })
  })

  describe("registerExpense", () => {
    it("registra el gasto redondeado a 2 decimales", async () => {
      let captured: CreateCashExpenseData | undefined
      const repo = makeFakeRepo({
        createExpense: async (data) => { captured = data },
      })
      const service = createCashRegisterService(repo)

      await service.registerExpense({
        session_id: "session-1",
        store_id: "store-1",
        user_id: "user-1",
        amount: 100.456,
        reason: "compra_inventario",
      })

      assert.equal(captured?.amount, 100.46)
    })

    it("rechaza monto menor o igual a cero", async () => {
      const service = createCashRegisterService(makeFakeRepo())

      await assert.rejects(
        () => service.registerExpense({
          session_id: "session-1",
          store_id: "store-1",
          user_id: "user-1",
          amount: 0,
          reason: "compra_inventario",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })
  })

  describe("computeArqueo (pure function)", () => {
    it("calcula esperado y faltante centavo a centavo", () => {
      // fondo 200 + ventas efectivo 1280.50 + cobros deudas 120 = 1600.50
      const r = computeArqueo(200, 1280.5 + 120, 1470)
      assert.equal(r.expected_amount, 1600.5)
      assert.equal(r.difference, -130.5)
    })

    it("resta los gastos en efectivo del esperado", () => {
      // fondo 200 + ventas 1280.50 − compras 300 = 1180.50
      const r = computeArqueo(200, 1280.5, 1180.5, 300)
      assert.equal(r.expected_amount, 1180.5)
      assert.equal(r.difference, 0)
    })

    it("sobrante positivo", () => {
      const r = computeArqueo(0, 100, 110)
      assert.equal(r.expected_amount, 100)
      assert.equal(r.difference, 10)
    })

    it("sin diferencias", () => {
      const r = computeArqueo(500.25, 999.75, 1500)
      assert.equal(r.expected_amount, 1500)
      assert.equal(r.difference, 0)
    })

    it("evita artefactos de flotantes (0.1 + 0.2)", () => {
      const r = computeArqueo(0.1, 0.2, 0.3)
      assert.equal(r.expected_amount, 0.3)
      assert.equal(r.difference, 0)
    })
  })
})
