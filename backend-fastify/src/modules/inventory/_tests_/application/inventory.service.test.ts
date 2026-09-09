import { describe, it, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import { createInventoryService } from "../../application/inventory.service"
import type { IInventoryRepository, ICashIntegrationPort } from "../../domain/inventory.interface"
import type { IInventoryMovementEntity, CreateMovementData } from "../../domain/inventory.entities"
import type { IProductRepository } from "../../../products/domain/products.interface"
import type { IProductEntity } from "../../../products/domain/products.entities"
import { NotFoundError, BadRequestError } from "@/core/errors/AppError"

function makeMovement(overrides: Partial<IInventoryMovementEntity> = {}): IInventoryMovementEntity {
  return {
    id: "mov-1",
    product_id: "prod-1",
    product_name: "Widget",
    movement_type: "entrada",
    quantity: 10,
    unit_cost: 5,
    unit_type: null,
    unit_quantity: null,
    note: null,
    user_id: "user-1",
    batch_id: null,
    store_id: "store-1",
    created_at: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  } as unknown as IInventoryMovementEntity
}

function makeProduct(overrides: Partial<IProductEntity> = {}): IProductEntity {
  return {
    id: "prod-1",
    name: "Widget",
    price: 25 as any,
    cost: 5 as any,
    stock: 100,
    low_stock_threshold: 10,
    active: true,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-09-01T00:00:00Z"),
    deleted_at: undefined,
    ...overrides,
  }
}

function makeFakeMovementRepo(overrides: Partial<IInventoryRepository> = {}): IInventoryRepository {
  return {
    create: async () => makeMovement(),
    findByProductId: async () => [],
    findAll: async () => ({ movements: [], total: 0, page: 1, limit: 10 }),
    ...overrides,
  }
}

function makeFakeProductRepo(overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    findAll: async () => ({ products: [], total: 0, page: 1, limit: 10 }),
    findById: async () => makeProduct(),
    findByBarcode: async () => null,
    findByBarcodes: async () => [],
    resolveCategoryNames: async () => [],
    resolveSupplierNames: async () => [],
    create: async () => makeProduct(),
    createMany: async () => ({ count: 0 }),
    update: async () => makeProduct(),
    softDelete: async () => {},
    softDeleteMany: async () => ({ count: 0, ids: [] }),
    softDeleteAllByFilters: async () => ({ count: 0, ids: [] }),
    updateStock: async () => makeProduct(),
    ...overrides,
  }
}

function makeFakeCashPort(overrides: Partial<ICashIntegrationPort> = {}): ICashIntegrationPort {
  return {
    resolveExpenseSession: async () => ({ session_id: "session-1" }),
    registerExpense: async () => {},
    ...overrides,
  }
}

describe("inventory service", () => {
  beforeEach(() => {
    mock.restoreAll()
  })

  describe("create", () => {
    it("creates an entrada movement and increases stock", async () => {
      let capturedStock: number | undefined
      const productRepo = makeFakeProductRepo({
        updateStock: async (_id, qty) => {
          capturedStock = qty
          return makeProduct({ stock: 110 })
        },
      })
      const movRepo = makeFakeMovementRepo()
      const service = createInventoryService(movRepo, productRepo)

      const result = await service.create({
        product_id: "prod-1",
        movement_type: "entrada",
        quantity: 10,
        user_id: "user-1",
      })

      assert.equal(capturedStock, 10)
      assert.equal(result.movement_type, "entrada")
      assert.equal(result.product_name, "Widget")
    })

    it("creates a salida movement and decreases stock", async () => {
      let capturedStock: number | undefined
      const productRepo = makeFakeProductRepo({
        updateStock: async (_id, qty) => {
          capturedStock = qty
          return makeProduct({ stock: 90 })
        },
      })
      const movRepo = makeFakeMovementRepo()
      const service = createInventoryService(movRepo, productRepo)

      await service.create({
        product_id: "prod-1",
        movement_type: "salida",
        quantity: 10,
        user_id: "user-1",
      })

      assert.equal(capturedStock, -10)
    })

    it("throws NotFoundError when product does not exist", async () => {
      const productRepo = makeFakeProductRepo({ findById: async () => null })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.create({
          product_id: "ghost",
          movement_type: "entrada",
          quantity: 5,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws NotFoundError when product is soft-deleted", async () => {
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ deleted_at: new Date() }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "entrada",
          quantity: 5,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws BadRequestError on salida with insufficient stock", async () => {
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ stock: 5 }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "salida",
          quantity: 10,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("allows salida when stock exactly equals quantity", async () => {
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ stock: 10 }),
      })
      const movRepo = makeFakeMovementRepo({
        create: async (data: CreateMovementData) => makeMovement({ movement_type: data.movement_type }),
      })
      const service = createInventoryService(movRepo, productRepo)

      const result = await service.create({
        product_id: "prod-1",
        movement_type: "salida",
        quantity: 10,
        user_id: "user-1",
      })

      assert.equal(result.movement_type, "salida")
    })
  })

  describe("create - paid_cash integration", () => {
    it("registers expense when paid_cash is true on entrada", async () => {
      let capturedExpense: any = undefined
      const cashPort = makeFakeCashPort({
        registerExpense: async (data) => { capturedExpense = data },
      })
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ name: "Gadget" }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo, cashPort)

      await service.create({
        product_id: "prod-1",
        movement_type: "entrada",
        quantity: 5,
        unit_cost: 12.5,
        paid_cash: true,
        user_id: "user-1",
        store_id: "store-1",
      })

      assert.equal(capturedExpense.amount, 62.5)
      assert.equal(capturedExpense.reason, "compra_inventario")
      assert.equal(capturedExpense.source_type, "inventory_movement")
      assert.equal(capturedExpense.description, "Compra: Gadget x5")
    })

    it("throws BadRequestError when paid_cash but no cashPort", async () => {
      const productRepo = makeFakeProductRepo()
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "entrada",
          quantity: 5,
          unit_cost: 10,
          paid_cash: true,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("throws BadRequestError when paid_cash on salida", async () => {
      const productRepo = makeFakeProductRepo()
      const service = createInventoryService(makeFakeMovementRepo(), productRepo, makeFakeCashPort())

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "salida",
          quantity: 5,
          unit_cost: 10,
          paid_cash: true,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("throws BadRequestError when paid_cash without unit_cost", async () => {
      const productRepo = makeFakeProductRepo()
      const service = createInventoryService(makeFakeMovementRepo(), productRepo, makeFakeCashPort())

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "entrada",
          quantity: 5,
          paid_cash: true,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("throws BadRequestError when paid_cash with unit_cost of 0", async () => {
      const productRepo = makeFakeProductRepo()
      const service = createInventoryService(makeFakeMovementRepo(), productRepo, makeFakeCashPort())

      await assert.rejects(
        () => service.create({
          product_id: "prod-1",
          movement_type: "entrada",
          quantity: 5,
          unit_cost: 0,
          paid_cash: true,
          user_id: "user-1",
        }),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("does not register expense when paid_cash is false", async () => {
      let called = false
      const cashPort = makeFakeCashPort({
        registerExpense: async () => { called = true },
      })
      const service = createInventoryService(makeFakeMovementRepo(), makeFakeProductRepo(), cashPort)

      await service.create({
        product_id: "prod-1",
        movement_type: "entrada",
        quantity: 5,
        unit_cost: 10,
        paid_cash: false,
        user_id: "user-1",
      })

      assert.equal(called, false)
    })

    it("rounds expense amount to 2 decimals", async () => {
      let capturedExpense: any = undefined
      const cashPort = makeFakeCashPort({
        registerExpense: async (data) => { capturedExpense = data },
      })
      const service = createInventoryService(makeFakeMovementRepo(), makeFakeProductRepo(), cashPort)

      await service.create({
        product_id: "prod-1",
        movement_type: "entrada",
        quantity: 3,
        unit_cost: 10.333,
        paid_cash: true,
        user_id: "user-1",
        store_id: "store-1",
      })

      assert.equal(capturedExpense.amount, 31)
    })
  })

  describe("getByProduct", () => {
    it("returns movements for a product", async () => {
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ name: "Gadget" }),
      })
      const movRepo = makeFakeMovementRepo({
        findByProductId: async () => [makeMovement({ product_name: "Gadget" })],
      })
      const service = createInventoryService(movRepo, productRepo)

      const result = await service.getByProduct("prod-1")

      assert.equal(result.movements.length, 1)
      assert.equal(result.movements[0].product_name, "Gadget")
      assert.equal(result.total, 1)
    })

    it("throws NotFoundError when product does not exist", async () => {
      const productRepo = makeFakeProductRepo({ findById: async () => null })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.getByProduct("ghost"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws NotFoundError when product is soft-deleted", async () => {
      const productRepo = makeFakeProductRepo({
        findById: async () => makeProduct({ deleted_at: new Date() }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      await assert.rejects(
        () => service.getByProduct("prod-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("list", () => {
    it("returns paginated movements", async () => {
      const movRepo = makeFakeMovementRepo({
        findAll: async () => ({
          movements: [makeMovement(), makeMovement({ id: "mov-2" })],
          total: 2,
          page: 1,
          limit: 10,
        }),
      })
      const service = createInventoryService(movRepo, makeFakeProductRepo())

      const result = await service.list({ page: 1, limit: 10 })

      assert.equal(result.movements.length, 2)
      assert.equal(result.total, 2)
      assert.equal(result.page, 1)
    })

    it("returns empty list when no movements exist", async () => {
      const service = createInventoryService(makeFakeMovementRepo(), makeFakeProductRepo())

      const result = await service.list()

      assert.equal(result.movements.length, 0)
      assert.equal(result.total, 0)
    })
  })

  describe("getLowStockProducts", () => {
    it("returns products with stock info", async () => {
      const productRepo = makeFakeProductRepo({
        findAll: async () => ({
          products: [
            makeProduct({ name: "Low Item", stock: 3, low_stock_threshold: 10 }),
            makeProduct({ id: "prod-2", name: "Ok Item", stock: 50, low_stock_threshold: 10 }),
          ],
          total: 2,
          page: 1,
          limit: 200,
        }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      const result = await service.getLowStockProducts(productRepo)

      assert.equal(result.length, 2)
      assert.equal(result[0].is_low_stock, true)
      assert.equal(result[1].is_low_stock, false)
    })

    it("returns empty when no low stock products", async () => {
      const productRepo = makeFakeProductRepo({
        findAll: async () => ({ products: [], total: 0, page: 1, limit: 200 }),
      })
      const service = createInventoryService(makeFakeMovementRepo(), productRepo)

      const result = await service.getLowStockProducts(productRepo)

      assert.equal(result.length, 0)
    })
  })
})
