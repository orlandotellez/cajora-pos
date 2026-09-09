import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createProductService } from "../../application/products.service"
import type { IProductRepository } from "../../domain/products.interface"
import type { IProductEntity, CreateProductData, UpdateProductData } from "../../domain/products.entities"
import { NotFoundError, ConflictError } from "../../../../core/errors/AppError"

function decimal(value: number) {
  return { toString: () => String(value) } as unknown as IProductEntity["price"]
}

function entity(overrides: Partial<IProductEntity> = {}): IProductEntity {
  const now = new Date("2024-01-01T00:00:00.000Z")
  return {
    id: "prod-1",
    barcode: "7500000000001",
    name: "Coca Cola",
    unit_type: "botella",
    unit_quantity: 1.5,
    price: decimal(18.5),
    cost: decimal(12),
    stock: 100,
    low_stock_threshold: 10,
    active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

type Tracker = {
  findAll: { params: Parameters<IProductRepository["findAll"]>[0]; called: boolean }
  findById: { calls: [string, string | undefined][]; results: Map<string, IProductEntity | null> }
  findByBarcode: { call: { barcode: string; storeId: string | undefined } | null }
  created: CreateProductData | null
  updated: { id: string; data: UpdateProductData; storeId: string | undefined } | null
  deleted: { id: string; storeId: string | undefined } | null
  deletedMany: { ids: string[]; storeId: string | undefined } | null
  deletedAll: { filters: Parameters<IProductRepository["softDeleteAllByFilters"]>[0] } | null
}

function newTracker(): Tracker {
  return {
    findAll: { params: undefined, called: false },
    findById: { calls: [], results: new Map() },
    findByBarcode: { call: null },
    created: null,
    updated: null,
    deleted: null,
    deletedMany: null,
    deletedAll: null,
  }
}

function fakeRepository(tracker: Tracker, overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    findAll: async (params) => {
      tracker.findAll = { params, called: true }
      return { products: [entity()], total: 1, page: params?.page ?? 1, limit: params?.limit ?? 50 }
    },
    findById: async (id, storeId) => {
      tracker.findById.calls.push([id, storeId])
      return tracker.findById.results.get(id) ?? null
    },
    findByBarcode: async (barcode, storeId) => {
      tracker.findByBarcode.call = { barcode, storeId }
      return null
    },
    findByBarcodes: async (barcodes) => barcodes.map((barcode) => ({ barcode })),
    resolveCategoryNames: async () => [],
    resolveSupplierNames: async () => [],
    create: async (data) => {
      tracker.created = data
      return { ...entity(), ...data, id: "prod-new" } as unknown as IProductEntity
    },
    createMany: async (data) => ({ count: data.length }),
    update: async (id, data, storeId) => {
      tracker.updated = { id, data, storeId }
      return { ...entity(), ...data, id } as unknown as IProductEntity
    },
    softDelete: async (id, storeId) => {
      tracker.deleted = { id, storeId }
    },
    softDeleteMany: async (ids, storeId) => {
      tracker.deletedMany = { ids, storeId }
      return { count: ids.length, ids }
    },
    softDeleteAllByFilters: async (filters) => {
      tracker.deletedAll = { filters }
      return { count: 3, ids: ["a", "b", "c"] }
    },
    updateStock: async (id, q) => entity({ id, stock: q }),
    ...overrides,
  }
}

describe("createProductService.list", () => {
  it("maps each product to a response and propagates page/limit/total", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.list({ search: "coca", page: 2, limit: 10 })

    assert.equal(tracker.findAll.called, true)
    assert.equal(res.total, 1)
    assert.equal(res.page, 2)
    assert.equal(res.limit, 10)
    assert.equal(res.products.length, 1)
    assert.equal(res.products[0].name, "Coca Cola")
    assert.equal(res.products[0].price, 18.5)
    assert.equal(res.products[0].cost, 12)
  })
})

describe("createProductService.getById", () => {
  it("returns the mapped product response", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity({ name: "Fanta" }))
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.getById("prod-1", "store-1")

    assert.deepEqual(tracker.findById.calls[0], ["prod-1", "store-1"])
    assert.equal(res.name, "Fanta")
    assert.equal(res.barcode, "7500000000001")
  })

  it("throws NotFoundError when the product does not exist", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("missing"), NotFoundError)
  })

  it("throws NotFoundError when the product is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity({ deleted_at: new Date() }))
    const svc = createProductService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("prod-1"), NotFoundError)
  })
})

describe("createProductService.getByBarcode", () => {
  it("returns null when the barcode has no match", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.getByBarcode("123", "store-1")

    assert.equal(res, null)
  })

  it("returns null when the matched product is soft-deleted", async () => {
    const tracker = newTracker()
    const deleted = entity({ deleted_at: new Date() })
    tracker.findById.results.set("prod-1", deleted)
    const svc = createProductService(
      fakeRepository(tracker, {
        findByBarcode: async () => deleted,
      }),
    )

    const res = await svc.getByBarcode("123", "store-1")

    assert.equal(res, null)
  })
})

describe("createProductService.create", () => {
  const payload: CreateProductData = {
    name: "Nuevo Producto",
    barcode: "999",
    price: 25,
    cost: 15,
  }

  it("creates and returns the response, checking barcode duplicates", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.create(payload, "store-1")

    assert.deepEqual(tracker.findByBarcode.call, { barcode: "999", storeId: "store-1" })
    assert.deepEqual(tracker.created, payload)
    assert.equal(res.name, "Nuevo Producto")
  })

  it("throws ConflictError when the barcode already exists", async () => {
    const tracker = newTracker()
    const svc = createProductService(
      fakeRepository(tracker, {
        findByBarcode: async () => entity(),
      }),
    )

    await assert.rejects(() => svc.create(payload, "store-1"), ConflictError)
    assert.equal(tracker.created, null)
  })

  it("skips the duplicate check when no barcode is provided", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.create({ name: "Sueltito", price: 9 }, "store-1")

    assert.equal(tracker.findByBarcode.call, null)
    assert.equal(res.name, "Sueltito")
  })
})

describe("createProductService.update", () => {
  it("updates and returns the mapped product", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity({ barcode: "old" }))
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.update("prod-1", { name: "Renombrado" }, "store-1")

    assert.deepEqual(tracker.updated, { id: "prod-1", data: { name: "Renombrado" }, storeId: "store-1" })
    assert.equal(res.name, "Renombrado")
  })

  it("throws NotFoundError when the product does not exist", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("missing", { name: "X" }), NotFoundError)
  })

  it("throws ConflictError when the new barcode belongs to another product", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity({ barcode: "old", id: "prod-1" }))
    const svc = createProductService(
      fakeRepository(tracker, {
        findByBarcode: async () => entity({ id: "prod-2", barcode: "new" }),
      }),
    )

    await assert.rejects(() => svc.update("prod-1", { barcode: "new" }), ConflictError)
  })

  it("allows keeping the same barcode without conflict", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity({ barcode: "same", id: "prod-1" }))
    const svc = createProductService(
      fakeRepository(tracker, {
        findByBarcode: async () => entity({ id: "prod-1", barcode: "same" }),
      }),
    )

    const res = await svc.update("prod-1", { barcode: "same" }, "store-1")

    assert.equal(res.barcode, "same")
  })
})

describe("createProductService.delete", () => {
  it("soft-deletes an existing product", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("prod-1", entity())
    const svc = createProductService(fakeRepository(tracker))

    await svc.delete("prod-1", "store-1")

    assert.deepEqual(tracker.deleted, { id: "prod-1", storeId: "store-1" })
  })

  it("throws NotFoundError when the product does not exist", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("missing"), NotFoundError)
  })
})

describe("createProductService.deleteMany", () => {
  it("returns the deleted count and ids", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.deleteMany(["a", "b"], "store-1")

    assert.deepEqual(tracker.deletedMany, { ids: ["a", "b"], storeId: "store-1" })
    assert.deepEqual(res, { deleted: 2, ids: ["a", "b"] })
  })
})

describe("createProductService.deleteAllByFilters", () => {
  it("forwards filters and returns count and ids", async () => {
    const tracker = newTracker()
    const svc = createProductService(fakeRepository(tracker))

    const res = await svc.deleteAllByFilters({ search: "x", active: false })

    assert.deepEqual(tracker.deletedAll?.filters, { search: "x", active: false })
    assert.deepEqual(res, { deleted: 3, ids: ["a", "b", "c"] })
  })
})