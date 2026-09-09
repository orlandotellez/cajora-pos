import { describe, it, beforeEach, afterEach, mock } from "bun:test"
import assert from "node:assert/strict"
import { NotFoundError, BadRequestError, ConflictError } from "@/core/errors/AppError"
import type { IProductRepository } from "../../../products/domain/products.interface"

function fakeDecimal(n: number) {
  return { valueOf: () => n } as any
}

function makeProduct(overrides: Record<string, any> = {}): any {
  return {
    id: "product-1",
    name: "Producto Uno",
    price: fakeDecimal(100),
    cost: fakeDecimal(60),
    stock: 50,
    low_stock_threshold: 5,
    active: true,
    created_at: new Date("2026-08-01T10:00:00Z"),
    updated_at: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  }
}

function makeProductRepo(overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    async findAll(params) {
      return { products: [], total: 0, page: params?.page || 1, limit: params?.limit || 50 }
    },
    async findById(id, storeId) {
      return null
    },
    async findByBarcode(barcode, storeId) {
      return null
    },
    async findByBarcodes(barcodes, storeId) {
      return []
    },
    async resolveCategoryNames(names, storeId) {
      return []
    },
    async resolveSupplierNames(names, storeId) {
      return []
    },
    async create(data, storeId) {
      return makeProduct()
    },
    async createMany(data, storeId) {
      return { count: 0 }
    },
    async update(id, data, storeId) {
      return makeProduct({ id })
    },
    async softDelete(id, storeId) {},
    async softDeleteMany(ids, storeId) {
      return { count: 0, ids: [] }
    },
    async softDeleteAllByFilters(filters) {
      return { count: 0, ids: [] }
    },
    async updateStock(id, quantity, storeId) {
      return makeProduct({ id, stock: quantity })
    },
    ...overrides,
  }
}

function makeItem(overrides: Record<string, any> = {}): any {
  return {
    id: "item-1",
    product_id: "product-1",
    quantity: 5,
    unit_cost: 120.5,
    notes: "nota",
    product: { name: "Producto Uno" },
    ...overrides,
  }
}

function makeRichBatch(overrides: Record<string, any> = {}): any {
  return {
    id: "batch-1",
    movement_type: "entrada",
    supplier_id: "supplier-1",
    notes: "nota",
    user_id: "user-1",
    created_at: new Date("2026-09-01T10:00:00Z"),
    items: [makeItem()],
    supplier: { name: "Proveedor Uno" },
    user: { name: "Usuario Uno" },
    ...overrides,
  }
}

let createdBatchData: any
let stockUpdates: any[] = []
let createdMovements: any[] = []
let createdExpense: any
let findFirstArgs: any
let findManyArgs: any
let countArgs: any

const txMocks: Record<string, any> = {
  cash_session: {
    findUnique: async () => ({ status: "abierto" }),
  },
  inventory_batch: {
    create: async (args: any) => {
      createdBatchData = args
      return makeRichBatch({ movement_type: args.data.movement_type })
    },
  },
  product: {
    update: async (args: any) => {
      stockUpdates.push(args)
      return { id: args.where.id }
    },
  },
  inventory_movement: {
    create: async (args: any) => {
      createdMovements.push(args.data)
      return args.data
    },
  },
  user: {
    findUnique: async () => ({ name: "Usuario Uno" }),
  },
  cash_expense: {
    create: async (args: any) => {
      createdExpense = args.data
      return args.data
    },
  },
}

const prismaMocks: Record<string, any> = {
  cash_session: {
    findFirst: async () => null,
    findMany: async () => [],
  },
  inventory_batch: {
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
  },
  $transaction: async (fn: any) => fn(txMocks),
}

mock.module("@/config/prisma", () => ({
  prisma: prismaMocks,
}))

const { createBatchInventoryService } = await import("../../application/batch-inventory.service")

beforeEach(() => {
  prismaMocks.cash_session.findFirst = async () => null
  prismaMocks.cash_session.findMany = async () => []
  prismaMocks.inventory_batch.findFirst = async () => null
  prismaMocks.inventory_batch.findMany = async () => []
  prismaMocks.inventory_batch.count = async () => 0

  txMocks.cash_session.findUnique = async () => ({ status: "abierto" })
  txMocks.inventory_batch.create = async (args: any) => {
    createdBatchData = args
    return makeRichBatch({ movement_type: args.data.movement_type })
  }
  txMocks.product.update = async (args: any) => {
    stockUpdates.push(args)
    return { id: args.where.id }
  }
  txMocks.inventory_movement.create = async (args: any) => {
    createdMovements.push(args.data)
    return args.data
  }
  txMocks.user.findUnique = async () => ({ name: "Usuario Uno" })
  txMocks.cash_expense.create = async (args: any) => {
    createdExpense = args.data
    return args.data
  }

  stockUpdates = []
  createdMovements = []
  createdBatchData = undefined
  createdExpense = undefined
  findFirstArgs = undefined
  findManyArgs = undefined
  countArgs = undefined
})

afterEach(() => {
  mock.restore()
})

describe("batch-inventory service", () => {
  describe("create", () => {
    it("throws NotFound when a product does not exist", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return null
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        items: [{ product_id: "product-1", quantity: 2 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof NotFoundError && /Product product-1 not found/.test(err.message)
      )
    })

    it("throws NotFound when a product is soft deleted", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct({ deleted_at: new Date("2026-08-02T10:00:00Z") })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        items: [{ product_id: "product-1", quantity: 2 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof NotFoundError && /Product product-1 not found/.test(err.message)
      )
    })

    it("throws NotFound when only one of several products is missing", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          if (id === "product-1") return makeProduct()
          return null
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        items: [
          { product_id: "product-1", quantity: 5 },
          { product_id: "product-2", quantity: 3 },
        ],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof NotFoundError && /Product product-2 not found/.test(err.message)
      )
    })

    it("creates a multi-product batch and updates stock for every item", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          if (id === "product-1") return makeProduct()
          return makeProduct({ id: "product-2", name: "Producto Dos", stock: 10 })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        supplier_id: "supplier-1",
        notes: "nota de lote",
        user_id: "user-1",
        store_id: "store-1",
        items: [
          { product_id: "product-1", quantity: 5, unit_cost: 120.5, notes: "item note" },
          { product_id: "product-2", quantity: 3, unit_cost: 50, notes: "otra nota" },
        ],
      }

      const result = await service.create(data)

      assert.equal(result.id, "batch-1")
      assert.equal(createdBatchData.data.movement_type, "entrada")
      assert.equal(createdBatchData.data.supplier_id, "supplier-1")
      assert.equal(createdBatchData.data.notes, "nota de lote")
      assert.equal(createdBatchData.data.user_id, "user-1")
      assert.equal(createdBatchData.data.store_id, "store-1")
      assert.deepEqual(createdBatchData.data.items.create, [
        { product_id: "product-1", quantity: 5, unit_cost: 120.5, notes: "item note" },
        { product_id: "product-2", quantity: 3, unit_cost: 50, notes: "otra nota" },
      ])
      assert.equal(stockUpdates.length, 2)
      assert.equal(stockUpdates[0].where.id, "product-1")
      assert.equal(stockUpdates[0].data.stock.increment, 5)
      assert.equal(stockUpdates[1].where.id, "product-2")
      assert.equal(stockUpdates[1].data.stock.increment, 3)
      assert.equal(createdMovements.length, 2)
      assert.equal(createdMovements[0].product_id, "product-1")
      assert.equal(createdMovements[0].movement_type, "entrada")
      assert.equal(createdMovements[0].quantity, 5)
      assert.equal(createdMovements[0].unit_cost, 120.5)
      assert.equal(createdMovements[0].note, "nota de lote")
      assert.equal(createdMovements[0].batch_id, "batch-1")
      assert.equal(createdMovements[0].user_id, "user-1")
      assert.equal(createdMovements[0].store_id, "store-1")
      assert.equal(createdMovements[1].product_id, "product-2")
      assert.equal(createdMovements[1].quantity, 3)
    })

    it("throws BadRequest when stock is insufficient for a salida", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct({ stock: 3 })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "salida",
        user_id: "user-1",
        store_id: "store-1",
        items: [{ product_id: "product-1", quantity: 5 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof BadRequestError && /Insufficient stock for product Producto Uno/.test(err.message)
      )
    })

    it("creates a salida batch with negative stock increments", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct({ stock: 10 })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "salida",
        user_id: "user-1",
        store_id: "store-1",
        items: [{ product_id: "product-1", quantity: 4, unit_cost: 100 }],
      }

      const result = await service.create(data)

      assert.equal(result.movement_type, "salida")
      assert.equal(stockUpdates[0].data.stock.increment, -4)
      assert.equal(createdMovements[0].movement_type, "salida")
      assert.equal(createdMovements[0].quantity, 4)
    })

    it("throws BadRequest when paying cash for a non-entrada movement", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct({ stock: 10 })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "salida",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof BadRequestError && /Solo las entradas/.test(err.message)
      )
    })

    it("throws BadRequest when paying cash and no item has a unit cost", async () => {
      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof BadRequestError && /Para pagar en efectivo/.test(err.message)
      )
    })

    it("throws Conflict when paying cash and no cash session is open", async () => {
      prismaMocks.cash_session.findFirst = async () => null
      prismaMocks.cash_session.findMany = async () => []

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof ConflictError && /No hay una caja abierta/.test(err.message)
      )
    })

    it("throws Conflict when paying cash and several sessions are open", async () => {
      prismaMocks.cash_session.findFirst = async () => null
      prismaMocks.cash_session.findMany = async () => [{ id: "cs-1" }, { id: "cs-2" }]

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof ConflictError && /varias cajas/.test(err.message)
      )
    })

    it("registers a cash expense against the user own open session", async () => {
      prismaMocks.cash_session.findFirst = async () => ({ id: "cs-own", user_id: "user-1" })

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await service.create(data)

      assert.ok(createdExpense)
      assert.equal(createdExpense.session_id, "cs-own")
      assert.equal(createdExpense.amount, 200)
      assert.equal(createdExpense.reason, "compra_inventario")
      assert.equal(createdExpense.source_type, "inventory_batch")
      assert.equal(createdExpense.ref_id, "batch-1")
      assert.equal(createdExpense.description, "Compra por lote (1 ítems)")
      assert.equal(createdExpense.user_id, "user-1")
      assert.equal(createdExpense.user_name, "Usuario Uno")
      assert.equal(createdExpense.store_id, "store-1")
    })

    it("falls back to the single open session when the user has none", async () => {
      prismaMocks.cash_session.findFirst = async () => null
      prismaMocks.cash_session.findMany = async () => [{ id: "cs-solo" }]

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await service.create(data)

      assert.equal(createdExpense.session_id, "cs-solo")
    })

    it("throws Conflict when the session closes inside the transaction", async () => {
      txMocks.cash_session.findUnique = async () => ({ status: "cerrado" })
      prismaMocks.cash_session.findFirst = async () => ({ id: "cs-own", user_id: "user-1" })

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await assert.rejects(
        () => service.create(data),
        (err) => err instanceof ConflictError && /se cerró/.test(err.message)
      )
    })

    it("rounds the cash expense total to two decimals", async () => {
      prismaMocks.cash_session.findFirst = async () => ({ id: "cs-own", user_id: "user-1" })

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          if (id === "product-1") return makeProduct()
          return makeProduct({ id: "product-2", name: "Producto Dos" })
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [
          { product_id: "product-1", quantity: 1, unit_cost: 0.1 },
          { product_id: "product-2", quantity: 1, unit_cost: 0.2 },
        ],
      }

      await service.create(data)

      assert.equal(createdExpense.amount, 0.3)
    })

    it("uses trimmed notes as the cash expense description", async () => {
      prismaMocks.cash_session.findFirst = async () => ({ id: "cs-own", user_id: "user-1" })

      const productRepo = makeProductRepo({
        async findById(id, storeId) {
          return makeProduct()
        },
      })

      const service = createBatchInventoryService(productRepo)
      const data: any = {
        movement_type: "entrada",
        notes: "  compra urgente  ",
        user_id: "user-1",
        store_id: "store-1",
        paid_cash: true,
        items: [{ product_id: "product-1", quantity: 2, unit_cost: 100 }],
      }

      await service.create(data)

      assert.equal(createdExpense.description, "compra urgente")
    })
  })

  describe("getById", () => {
    it("returns the mapped batch when found and scopes by store", async () => {
      prismaMocks.inventory_batch.findFirst = async (args: any) => {
        findFirstArgs = args
        return makeRichBatch()
      }

      const service = createBatchInventoryService(makeProductRepo())
      const result = await service.getById("batch-1", "store-1")

      assert.equal(result.id, "batch-1")
      assert.equal(result.movement_type, "entrada")
      assert.equal(result.supplier_name, "Proveedor Uno")
      assert.equal(result.user_name, "Usuario Uno")
      assert.equal(result.total_items, 1)
      assert.equal(result.total_quantity, 5)
      assert.equal(result.items![0].product_name, "Producto Uno")
      assert.equal(findFirstArgs.where.id, "batch-1")
      assert.equal(findFirstArgs.where.store_id, "store-1")
    })

    it("throws NotFound when no batch matches", async () => {
      const service = createBatchInventoryService(makeProductRepo())

      await assert.rejects(
        () => service.getById("missing", "store-1"),
        (err) => err instanceof NotFoundError && /Batch not found/.test(err.message)
      )
    })
  })

  describe("list", () => {
    it("returns paginated batches with defaults", async () => {
      prismaMocks.inventory_batch.findMany = async (args: any) => {
        findManyArgs = args
        return [makeRichBatch()]
      }
      prismaMocks.inventory_batch.count = async (args: any) => {
        countArgs = args
        return 3
      }

      const service = createBatchInventoryService(makeProductRepo())
      const result = await service.list()

      assert.equal(result.total, 3)
      assert.equal(result.page, 1)
      assert.equal(result.limit, 50)
      assert.equal(result.batches.length, 1)
      assert.equal(result.batches[0].id, "batch-1")
      assert.deepEqual(findManyArgs.where, {})
      assert.equal(findManyArgs.skip, 0)
      assert.equal(findManyArgs.take, 50)
      assert.equal(findManyArgs.orderBy.created_at, "desc")
      assert.deepEqual(countArgs.where, {})
    })

    it("applies filters and pagination to the query", async () => {
      prismaMocks.inventory_batch.findMany = async (args: any) => {
        findManyArgs = args
        return [makeRichBatch()]
      }
      prismaMocks.inventory_batch.count = async (args: any) => {
        countArgs = args
        return 7
      }

      const service = createBatchInventoryService(makeProductRepo())
      const result = await service.list({
        movement_type: "entrada",
        supplier_id: "supplier-1",
        page: 2,
        limit: 10,
        storeId: "store-1",
      })

      assert.equal(result.total, 7)
      assert.equal(result.page, 2)
      assert.equal(result.limit, 10)
      assert.deepEqual(findManyArgs.where, {
        movement_type: "entrada",
        supplier_id: "supplier-1",
        store_id: "store-1",
      })
      assert.equal(findManyArgs.skip, 10)
      assert.equal(findManyArgs.take, 10)
      assert.deepEqual(countArgs.where, {
        movement_type: "entrada",
        supplier_id: "supplier-1",
        store_id: "store-1",
      })
    })
  })
})