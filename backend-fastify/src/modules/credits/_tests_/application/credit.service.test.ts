import { describe, it, beforeEach, afterEach, mock } from "bun:test"
import assert from "node:assert/strict"
import { BadRequestError, NotFoundError } from "@/core/errors/AppError"
import type { ICreditRepository } from "../../domain/credit.interface"
import type { ICreditPaymentEntity } from "../../domain/credit.entities"

const prismaMocks: Record<string, any> = {
  client: {
    findFirst: async () => null,
  },
  sale: {
    findFirst: async () => null,
  },
  credit_payment: {
    findMany: async () => [],
    aggregate: async () => ({ _sum: { amount: 0 } }),
  },
}

mock.module("@/config/prisma", () => ({
  prisma: prismaMocks,
}))

const { createCreditService } = await import("../../application/credit.service")

function makePayment(overrides: Partial<ICreditPaymentEntity> = {}): ICreditPaymentEntity {
  return {
    id: "payment-1",
    sale_id: "sale-1",
    client_id: "client-1",
    amount: 50,
    payment_method: "efectivo",
    notes: "abono",
    user_name: "",
    created_at: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  } as ICreditPaymentEntity
}

function makeCreditSale(overrides: Record<string, any> = {}): any {
  return {
    id: "sale-1",
    total: 200,
    paid: 50,
    pending: 150,
    created_at: new Date("2026-08-15T10:00:00Z"),
    items: [{ name: "Producto Uno", quantity: 2, line_total: 100 }],
    ...overrides,
  }
}

function makeCreditRepo(
  overrides: Partial<ICreditRepository> = {},
): ICreditRepository {
  return {
    async getClientsWithDebt(params) {
      return {
        clients: [
          {
            client_id: "client-1",
            client_name: "Cliente Uno",
            total_debt: 300,
            sale_count: 2,
          },
        ],
        total: 1,
        page: params?.page || 1,
        limit: params?.limit || 20,
      }
    },
    async getClientCreditSales(clientId, storeId) {
      return [makeCreditSale()]
    },
    async getSalePayments(saleId) {
      return [makePayment()]
    },
    async createPayment(data, userId, storeId) {
      return makePayment({ ...data, id: "payment-1", user_name: "Usuario Uno" } as any)
    },
    async getTotalPending(storeId) {
      return 1500
    },
    ...overrides,
  }
}

describe("credit service", () => {
  describe("getClientsWithDebt", () => {
    it("delegates to the repository and returns its response", async () => {
      let receivedParams: any
      const repo = makeCreditRepo({
        async getClientsWithDebt(params) {
          receivedParams = params
          return {
            clients: [{ client_id: "client-1", client_name: "Cliente Uno", total_debt: 300, sale_count: 2 }],
            total: 1,
            page: 1,
            limit: 20,
          }
        },
      })

      const result = await createCreditService(repo).getClientsWithDebt({
        search: "uno",
        page: 2,
        limit: 10,
        storeId: "store-1",
        filter: "morosos",
      })

      assert.deepEqual(receivedParams, {
        search: "uno",
        page: 2,
        limit: 10,
        storeId: "store-1",
        filter: "morosos",
      })
      assert.equal(result.total, 1)
      assert.equal(result.clients[0].client_name, "Cliente Uno")
    })
  })

  describe("getClientDebt", () => {
    it("throws NotFound when the client does not exist", async () => {
      prismaMocks.client.findFirst = async () => null

      await assert.rejects(
        createCreditService(makeCreditRepo()).getClientDebt("missing", "store-1"),
        NotFoundError,
      )
    })

    it("includes only sales with pending balance and maps payments with user names", async () => {
      prismaMocks.client.findFirst = async () => ({
        id: "client-1",
        name: "Cliente Uno",
        phone: "555-1234",
      })
      prismaMocks.credit_payment.findMany = async () => [
        { id: "payment-1", user: { name: "Usuario Uno" } },
        { id: "payment-2", user: { name: "Usuario Dos" } },
      ]

      const repo = makeCreditRepo({
        async getClientCreditSales() {
          return [
            makeCreditSale({ id: "sale-1", pending: 150 }),
            makeCreditSale({ id: "sale-2", pending: 0 }),
          ]
        },
        async getSalePayments(saleId) {
          if (saleId === "sale-1") {
            return [
              makePayment({ id: "payment-1", sale_id: "sale-1" }),
              makePayment({ id: "payment-2", sale_id: "sale-1", amount: 30 }),
            ]
          }
          return []
        },
      })

      const result = await createCreditService(repo).getClientDebt("client-1", "store-1")

      assert.equal(result.client.client_name, "Cliente Uno")
      assert.equal(result.client.client_phone, "555-1234")
      assert.equal(result.client.total_debt, 300)
      assert.equal(result.sales.length, 1)
      assert.equal(result.sales[0].id, "sale-1")
      assert.equal(result.payments.length, 2)
      assert.equal(result.payments[0].user_name, "Usuario Uno")
      assert.equal(result.payments[1].user_name, "Usuario Dos")
    })

    it("returns zero debt when the client is not in the summary", async () => {
      prismaMocks.client.findFirst = async () => ({
        id: "client-1",
        name: "Cliente Uno",
        phone: null,
      })
      prismaMocks.credit_payment.findMany = async () => []

      const repo = makeCreditRepo({
        async getClientCreditSales() {
          return []
        },
        async getSalePayments() {
          return []
        },
        async getClientsWithDebt() {
          return {
            clients: [],
            total: 0,
            page: 1,
            limit: 20,
          }
        },
      })

      const result = await createCreditService(repo).getClientDebt("client-1", "store-1")

      assert.equal(result.client.total_debt, 0)
      assert.equal(result.client.sale_count, 0)
      assert.equal(result.sales.length, 0)
      assert.equal(result.payments.length, 0)
    })

    it("does not query payment user names when there are no payments", async () => {
      prismaMocks.client.findFirst = async () => ({
        id: "client-1",
        name: "Cliente Uno",
        phone: null,
      })
      let findManyCalled = false
      prismaMocks.credit_payment.findMany = async () => {
        findManyCalled = true
        return []
      }

      const repo = makeCreditRepo({
        async getClientCreditSales() {
          return [makeCreditSale({ paid: 0, pending: 200 })]
        },
      })

      await createCreditService(repo).getClientDebt("client-1", "store-1")

      assert.equal(findManyCalled, false)
    })
  })

  describe("registerPayment", () => {
    const sale = {
      id: "sale-1",
      payment_method: "credito",
      total: 200,
      client_id: "client-1",
    }

    it("throws NotFound when the sale does not exist", async () => {
      prismaMocks.sale.findFirst = async () => null

      await assert.rejects(
        createCreditService(makeCreditRepo()).registerPayment(
          { sale_id: "sale-1", client_id: "client-1", amount: 50, payment_method: "efectivo" } as any,
          "user-1",
          "store-1",
        ),
        NotFoundError,
      )
    })

    it("throws BadRequest when the sale is not credit", async () => {
      prismaMocks.sale.findFirst = async () => ({ ...sale, payment_method: "efectivo" })

      await assert.rejects(
        createCreditService(makeCreditRepo()).registerPayment(
          { sale_id: "sale-1", client_id: "client-1", amount: 50, payment_method: "efectivo" } as any,
          "user-1",
          "store-1",
        ),
        BadRequestError,
      )
    })

    it("throws BadRequest when the client does not match the sale", async () => {
      prismaMocks.sale.findFirst = async () => sale

      await assert.rejects(
        createCreditService(makeCreditRepo()).registerPayment(
          { sale_id: "sale-1", client_id: "other-client", amount: 50, payment_method: "efectivo" } as any,
          "user-1",
          "store-1",
        ),
        BadRequestError,
      )
    })

    it("throws BadRequest when the amount is not positive", async () => {
      prismaMocks.sale.findFirst = async () => sale
      prismaMocks.credit_payment.aggregate = async () => ({ _sum: { amount: 0 } })

      await assert.rejects(
        createCreditService(makeCreditRepo()).registerPayment(
          { sale_id: "sale-1", client_id: "client-1", amount: 0, payment_method: "efectivo" } as any,
          "user-1",
          "store-1",
        ),
        BadRequestError,
      )
    })

    it("throws BadRequest when the amount exceeds the pending balance", async () => {
      prismaMocks.sale.findFirst = async () => sale
      prismaMocks.credit_payment.aggregate = async () => ({ _sum: { amount: 100 } })
      let errorMessage = ""
      const repo = makeCreditRepo()

      try {
        await createCreditService(repo).registerPayment(
          { sale_id: "sale-1", client_id: "client-1", amount: 150, payment_method: "efectivo" } as any,
          "user-1",
          "store-1",
        )
      } catch (error: any) {
        errorMessage = error.message
      }

      assert.match(errorMessage, /excede el saldo pendiente.*100\.00/)
    })

    it("creates the payment and returns the mapped response", async () => {
      prismaMocks.sale.findFirst = async () => sale
      prismaMocks.credit_payment.aggregate = async () => ({ _sum: { amount: 0 } })
      let received: any
      const repo = makeCreditRepo({
        async createPayment(data, userId, storeId) {
          received = { data, userId, storeId }
          return makePayment({ id: "payment-1", amount: data.amount })
        },
      })

      const result = await createCreditService(repo).registerPayment(
        { sale_id: "sale-1", client_id: "client-1", amount: 50, payment_method: "efectivo", notes: "abono" } as any,
        "user-1",
        "store-1",
      )

      assert.equal(received.data.sale_id, "sale-1")
      assert.equal(received.userId, "user-1")
      assert.equal(received.storeId, "store-1")
      assert.equal(result.id, "payment-1")
      assert.equal(result.amount, 50)
      assert.equal(result.sale_id, "sale-1")
      assert.equal(result.user_name, "")
    })
  })

  describe("getTotalPending", () => {
    it("delegates to the repository", async () => {
      let receivedStoreId: string | undefined
      const repo = makeCreditRepo({
        async getTotalPending(storeId) {
          receivedStoreId = storeId
          return 700
        },
      })

      const result = await createCreditService(repo).getTotalPending("store-1")

      assert.equal(result, 700)
      assert.equal(receivedStoreId, "store-1")
    })
  })
})