import { describe, it, beforeEach, afterEach, mock } from "bun:test"
import assert from "node:assert/strict"
import { NotFoundError, BadRequestError, ConflictError } from "@/core/errors/AppError"
import type { ISaleRepository } from "../../domain/sales.interface"
import type { RichSale } from "../../application/common/sales.mappers"

function fakeDecimal(n: number) {
  return { valueOf: () => n } as any
}

function makeSaleEntity(overrides: Record<string, any> = {}): any {
  return {
    id: "sale-1",
    subtotal: fakeDecimal(100),
    discount: fakeDecimal(10),
    total: fakeDecimal(90),
    payment_method: "tarjeta",
    amount_received: fakeDecimal(100),
    change_given: fakeDecimal(10),
    user_id: "user-1",
    user_name: "María",
    client_id: "client-1",
    client_name: "Juan",
    created_at: new Date("2026-08-20T10:30:00Z"),
    updated_at: new Date("2026-08-20T10:30:00Z"),
    items: [
      {
        id: "item-1",
        product_id: "p1",
        product_name: "Widget",
        quantity: 2,
        unit_price: fakeDecimal(50),
        line_total: fakeDecimal(100),
      },
    ],
    service_items: [],
    ...overrides,
  }
}

function makeRepo(overrides: Partial<ISaleRepository> = {}): ISaleRepository {
  return {
    async create(data, storeId, serviceProductsToDeduct, customServiceProducts) {
      return makeSaleEntity()
    },
    async findById(id, storeId) {
      return makeSaleEntity()
    },
    async findAll(params) {
      return { sales: [makeSaleEntity()], total: 1 }
    },
    async getReport(params) {
      return {
        totalSales: 10,
        totalRevenue: 1000,
        totalDiscount: 50,
        averageTicket: 100,
        salesByPaymentMethod: { tarjeta: 6, efectivo: 4 },
        topProducts: [{ productName: "Widget", quantity: 8, revenue: 400 }],
      }
    },
    async getRevenueTrend(params) {
      return [{ date: "2026-08-20", revenue: 1000 }]
    },
    async getRevenueByHour(params) {
      return [{ hour: 10, revenue: 500, sales: 5 }]
    },
    async getRevenueByCategory(params) {
      return [{ category_name: "Beauty", revenue: 800, quantity: 12 }]
    },
    async getProductPerformance(params) {
      return [{ product_id: "p1", product_name: "Widget", quantity: 8, revenue: 400, last_sale_date: "2026-08-20" }]
    },
    ...overrides,
  }
}

const prismaMocks: Record<string, any> = {
  product: {
    findMany: async () => [],
  },
  service_product: {
    findMany: async () => [],
  },
  cash_session: {
    findMany: async () => [],
  },
}

mock.module("@/config/prisma", () => ({
  prisma: prismaMocks,
}))

mock.module("@/modules/settings/infrastructure/settings.prisma.repository", () => ({
  SettingsRepository: {
    async get() {
      return null
    },
    async upsert() {
      return null
    },
  },
}))

const { createSaleService } = await import("../../application/sales.service")

beforeEach(() => {
  prismaMocks.product.findMany = async () => []
  prismaMocks.service_product.findMany = async () => []
  prismaMocks.cash_session.findMany = async () => []
})

afterEach(() => {
  mock.restore()
})

describe("sales service", () => {
  describe("create", () => {
    it("creates a regular sale and maps the response", async () => {
      let captured: { data: any; storeId: string; deduct: any; custom: any } | undefined

      const repo = makeRepo({
        async create(data, storeId, serviceProductsToDeduct, customServiceProducts) {
          captured = { data, storeId, deduct: serviceProductsToDeduct, custom: customServiceProducts }
          return makeSaleEntity()
        },
      } as any)

      prismaMocks.product.findMany = async () => [
        { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 10 },
      ]

      const service = createSaleService(repo)
      const data: any = {
        subtotal: 100,
        discount: 10,
        total: 90,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "p1", product_name: "Widget", quantity: 2, unit_price: 50, line_total: 100 }],
      }

      const result = await service.create(data, "store-1")

      assert.equal(result.id, "sale-1")
      assert.equal(result.total, 90)
      assert.ok(captured)
      assert.equal(captured.storeId, "store-1")
      assert.deepEqual(captured.deduct, [])
      assert.equal(captured.custom, undefined)
    })

    it("throws NotFound when a regular product does not exist", async () => {
      prismaMocks.product.findMany = async () => []

      const service = createSaleService(makeRepo())
      const data: any = {
        subtotal: 100,
        discount: 0,
        total: 100,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "ghost", product_name: "X", quantity: 1, unit_price: 100, line_total: 100 }],
      }

      await assert.rejects(
        () => service.create(data, "store-1"),
        (err) => err instanceof NotFoundError && /Product ghost not found/.test(err.message)
      )
    })

    it("throws BadRequest when stock is insufficient", async () => {
      prismaMocks.product.findMany = async () => [
        { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 1 },
      ]

      const service = createSaleService(makeRepo())
      const data: any = {
        subtotal: 200,
        discount: 0,
        total: 200,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "p1", product_name: "Widget", quantity: 5, unit_price: 50, line_total: 250 }],
      }

      await assert.rejects(
        () => service.create(data, "store-1"),
        (err) => err instanceof BadRequestError && /Insufficient stock/.test(err.message)
      )
    })

    it("throws BadRequest when services resolve to no products", async () => {
      prismaMocks.product.findMany = async () => []
      prismaMocks.service_product.findMany = async () => []

      const service = createSaleService(makeRepo())
      const data: any = {
        subtotal: 40,
        discount: 0,
        total: 40,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [],
        service_items: [{ service_id: "svc-ghost", service_name: "Limpieza", base_price: 40, line_total: 40 }],
      }

      await assert.rejects(
        () => service.create(data, "store-1"),
        (err) => err instanceof BadRequestError && /No products found/.test(err.message)
      )
    })

    it("validates stock across regular items and service auto-lookup products", async () => {
      let captured: { data: any; storeId: string; deduct: any; custom: any } | undefined

      prismaMocks.product.findMany = async () => [
        { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 3 },
      ]
      prismaMocks.service_product.findMany = async () => [
        {
          product_id: "p1",
          product: { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 3 },
          quantity: 2,
        },
      ]

      const repo = makeRepo({
        async create(data, storeId, serviceProductsToDeduct, customServiceProducts) {
          captured = { data, storeId, deduct: serviceProductsToDeduct, custom: customServiceProducts }
          return makeSaleEntity()
        },
      } as any)

      const service = createSaleService(repo)
      const data: any = {
        subtotal: 150,
        discount: 0,
        total: 150,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "p1", product_name: "Widget", quantity: 2, unit_price: 50, line_total: 100 }],
        service_items: [{ service_id: "svc-1", service_name: "Reparación", base_price: 50, line_total: 50 }],
      }

      await assert.rejects(
        () => service.create(data, "store-1"),
        (err) => err instanceof BadRequestError && /Insufficient stock/.test(err.message)
      )
      assert.equal(captured, undefined)
    })

    it("passes service-originating product deductions to the repository", async () => {
      let captured: { data: any; storeId: string; deduct: any; custom: any } | undefined

      prismaMocks.product.findMany = async () => []
      prismaMocks.service_product.findMany = async () => [
        {
          product_id: "p2",
          product: { id: "p2", name: "Shampoo", price: fakeDecimal(5), stock: 5 },
          quantity: 2,
        },
      ]

      const repo = makeRepo({
        async create(data, storeId, serviceProductsToDeduct, customServiceProducts) {
          captured = { data, storeId, deduct: serviceProductsToDeduct, custom: customServiceProducts }
          return makeSaleEntity()
        },
      } as any)

      const service = createSaleService(repo)
      const data: any = {
        subtotal: 40,
        discount: 0,
        total: 40,
        payment_method: "tarjeta",
        user_id: "user-1",
        user_name: "María",
        items: [],
        service_items: [{ service_id: "svc-1", service_name: "Limpieza", base_price: 40, line_total: 40 }],
      }

      const result = await service.create(data, "store-1")

      assert.ok(captured)
      assert.deepEqual(captured.deduct, [{ product_id: "p2", quantity: 2 }])
      assert.ok(captured.custom instanceof Map)
      assert.equal(captured.custom.size, 0)
      assert.equal(result.total, 90)
    })

    it("resolves cash_session_id from own open session when cash register is enabled", async () => {
      let captured: { data: any; storeId: string; deduct: any; custom: any } | undefined

      prismaMocks.product.findMany = async () => [
        { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 10 },
      ]
      prismaMocks.cash_session.findMany = async () => [
        { id: "cs-1", user_id: "user-1" },
      ]

      const repo = makeRepo({
        async create(data, storeId, serviceProductsToDeduct, customServiceProducts) {
          captured = { data, storeId, deduct: serviceProductsToDeduct, custom: customServiceProducts }
          return makeSaleEntity()
        },
      } as any)

      const service = createSaleService(repo)
      const data: any = {
        subtotal: 100,
        discount: 0,
        total: 100,
        payment_method: "efectivo",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "p1", product_name: "Widget", quantity: 2, unit_price: 50, line_total: 100 }],
      }

      await service.create(data, "store-1")

      assert.ok(captured)
      assert.equal(captured.data.cash_session_id, "cs-1")
    })

    it("throws Conflict when cash register is enabled and no session is open", async () => {
      prismaMocks.product.findMany = async () => [
        { id: "p1", name: "Widget", price: fakeDecimal(50), stock: 10 },
      ]
      prismaMocks.cash_session.findMany = async () => []

      const service = createSaleService(makeRepo())
      const data: any = {
        subtotal: 100,
        discount: 0,
        total: 100,
        payment_method: "efectivo",
        user_id: "user-1",
        user_name: "María",
        items: [{ product_id: "p1", product_name: "Widget", quantity: 2, unit_price: 50, line_total: 100 }],
      }

      await assert.rejects(
        () => service.create(data, "store-1"),
        (err) => err instanceof ConflictError
      )
    })
  })

  describe("getById", () => {
    it("returns the mapped sale when found", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getById("sale-1", "store-1")

      assert.equal(result.id, "sale-1")
      assert.equal(result.total, 90)
      assert.equal(result.created_at, "2026-08-20T10:30:00.000Z")
    })

    it("throws NotFound when no sale matches", async () => {
      const service = createSaleService(
        makeRepo({ findById: async () => null } as any)
      )

      await assert.rejects(
        () => service.getById("missing", "store-1"),
        (err) => err instanceof NotFoundError
      )
    })
  })

  describe("list", () => {
    it("returns paginated sales with defaults for page and limit", async () => {
      const repo = makeRepo({
        async findAll(params) {
          assert.ok(params.startDate instanceof Date)
          assert.ok(params.endDate instanceof Date)
          assert.equal(params.userId, "user-1")
          assert.equal(params.paymentMethod, "tarjeta")
          assert.equal(params.storeId, "store-1")
          return { sales: [makeSaleEntity()], total: 1 }
        },
      } as any)

      const service = createSaleService(repo)
      const result = await service.list({
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        user_id: "user-1",
        payment_method: "tarjeta",
        storeId: "store-1",
      })

      assert.equal(result.total, 1)
      assert.equal(result.page, 1)
      assert.equal(result.limit, 50)
      assert.equal(result.sales.length, 1)
      assert.equal(result.sales[0].id, "sale-1")
    })
  })

  describe("getReport", () => {
    it("maps report fields to camelCase response", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getReport({ start_date: "2026-08-01", end_date: "2026-08-31", storeId: "store-1" })

      assert.equal(result.total_sales, 10)
      assert.equal(result.total_revenue, 1000)
      assert.equal(result.total_discount, 50)
      assert.equal(result.average_ticket, 100)
      assert.deepEqual(result.sales_by_payment_method, { tarjeta: 6, efectivo: 4 })
      assert.deepEqual(result.top_products, [{ product_name: "Widget", quantity: 8, revenue: 400 }])
    })
  })

  describe("revenue and performance reports", () => {
    it("getRevenueTrend delegates and returns items", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getRevenueTrend({
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        group_by: "day",
        store_id: "store-1",
      })

      assert.equal(result.length, 1)
      assert.equal(result[0].revenue, 1000)
    })

    it("getRevenueByHour delegates and returns items", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getRevenueByHour({
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        store_id: "store-1",
      })

      assert.equal(result.length, 1)
      assert.equal(result[0].hour, 10)
      assert.equal(result[0].sales, 5)
    })

    it("getRevenueByCategory delegates and returns items", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getRevenueByCategory({
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        store_id: "store-1",
      })

      assert.equal(result.length, 1)
      assert.equal(result[0].category_name, "Beauty")
    })

    it("getProductPerformance delegates and returns items", async () => {
      const service = createSaleService(makeRepo())
      const result = await service.getProductPerformance({
        start_date: "2026-08-01",
        end_date: "2026-08-31",
        store_id: "store-1",
      })

      assert.equal(result.length, 1)
      assert.equal(result[0].product_name, "Widget")
    })
  })
})
