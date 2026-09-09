import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createServiceService } from "../../application/services.service"
import type { IServiceRepository } from "../../domain/services.interface"
import type { IServiceEntity, CreateServiceData, UpdateServiceData } from "../../domain/services.entities"
import { NotFoundError } from "@/core/errors/AppError"

function decimal(value: number) {
  return { toString: () => String(value) } as unknown as IServiceEntity["base_price"]
}

function makeService(overrides: Partial<IServiceEntity> = {}): IServiceEntity {
  const now = new Date("2026-08-01T09:00:00.000Z")
  return {
    id: "svc-1",
    name: "Corte de Cabello",
    description: "Corte básico",
    base_price: decimal(1500),
    is_active: true,
    created_at: now,
    updated_at: now,
    service_products: [
      {
        id: "sp-1",
        service_id: "svc-1",
        product_id: "prod-1",
        quantity: 2,
        product: { id: "prod-1", name: "Shampoo", price: decimal(500) },
      },
    ],
    ...overrides,
  }
}

type Tracker = {
  findAll: { params: Parameters<IServiceRepository["findAll"]>[0]; called: boolean }
  findById: { calls: [string, string | undefined][]; results: Map<string, IServiceEntity | null> }
  created: { data: CreateServiceData; storeId: string | undefined } | null
  updated: { id: string; data: UpdateServiceData; storeId: string | undefined } | null
  deleted: { id: string; storeId: string | undefined } | null
  deletedMany: { ids: string[]; storeId: string | undefined } | null
}

function newTracker(): Tracker {
  return {
    findAll: { params: undefined, called: false },
    findById: { calls: [], results: new Map() },
    created: null,
    updated: null,
    deleted: null,
    deletedMany: null,
  }
}

function fakeRepository(tracker: Tracker, overrides: Partial<IServiceRepository> = {}): IServiceRepository {
  return {
    findAll: async (params) => {
      tracker.findAll = { params, called: true }
      return { services: [makeService()], total: 1, page: params?.page ?? 1, limit: params?.limit ?? 50 }
    },
    findById: async (id, storeId) => {
      tracker.findById.calls.push([id, storeId])
      return tracker.findById.results.get(id) ?? null
    },
    create: async (data, storeId) => {
      tracker.created = { data, storeId }
      return { ...makeService(), ...data, id: "svc-new" } as unknown as IServiceEntity
    },
    update: async (id, data, storeId) => {
      tracker.updated = { id, data, storeId }
      return { ...makeService(), ...data, id } as unknown as IServiceEntity
    },
    softDelete: async (id, storeId) => {
      tracker.deleted = { id, storeId }
    },
    softDeleteMany: async (ids, storeId) => {
      tracker.deletedMany = { ids, storeId }
      return { count: ids.length }
    },
    ...overrides,
  }
}

describe("createServiceService.list", () => {
  it("maps each service to a response and propagates page/limit/total", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.list({ search: "corte", page: 2, limit: 10 }, "store-1")

    assert.equal(tracker.findAll.called, true)
    assert.deepEqual(tracker.findAll.params, { search: "corte", page: 2, limit: 10, storeId: "store-1" })
    assert.equal(res.total, 1)
    assert.equal(res.page, 2)
    assert.equal(res.limit, 10)
    assert.equal(res.services.length, 1)
    assert.equal(res.services[0].name, "Corte de Cabello")
    assert.equal(res.services[0].base_price, 1500)
    assert.equal(res.services[0].products[0].product_name, "Shampoo")
    assert.equal(res.services[0].products[0].product_price, 500)
    assert.equal(res.services[0].products[0].quantity, 2)
  })
})

describe("createServiceService.getById", () => {
  it("returns the mapped service response", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService({ name: "Manicura", base_price: decimal(800) }))
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.getById("svc-1", "store-1")

    assert.deepEqual(tracker.findById.calls[0], ["svc-1", "store-1"])
    assert.equal(res.name, "Manicura")
    assert.equal(res.base_price, 800)
  })

  it("throws NotFoundError when the service does not exist", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("missing"), NotFoundError)
  })

  it("throws NotFoundError when the service is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService({ deleted_at: new Date() }))
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("svc-1"), NotFoundError)
  })
})

describe("createServiceService.create", () => {
  const payload: CreateServiceData = {
    name: "Pedicura",
    description: "Pedicura completa",
    base_price: 1200,
  }

  it("creates and returns the mapped service, forwarding storeId", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.create(payload, "store-1")

    assert.deepEqual(tracker.created, { data: payload, storeId: "store-1" })
    assert.equal(res.name, "Pedicura")
    assert.equal(res.products.length, 1)
  })

  it("creates a service with products data", async () => {
    const tracker = newTracker()
    const withProducts: CreateServiceData = {
      ...payload,
      products: [{ product_id: "prod-1", quantity: 3 }],
    }
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.create(withProducts)

    assert.deepEqual(tracker.created?.data.products, [{ product_id: "prod-1", quantity: 3 }])
    assert.equal(res.is_active, true)
  })
})

describe("createServiceService.update", () => {
  it("updates and returns the mapped service", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService())
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.update("svc-1", { name: "Renombrado", base_price: 1900 }, "store-1")

    assert.deepEqual(tracker.updated, { id: "svc-1", data: { name: "Renombrado", base_price: 1900 }, storeId: "store-1" })
    assert.equal(res.name, "Renombrado")
    assert.equal(res.base_price, 1900)
  })

  it("throws NotFoundError when the service does not exist", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("missing", { name: "X" }), NotFoundError)
    assert.equal(tracker.updated, null)
  })

  it("throws NotFoundError when the service is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService({ deleted_at: new Date() }))
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("svc-1", { name: "X" }), NotFoundError)
  })
})

describe("createServiceService.delete", () => {
  it("soft-deletes an existing service", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService())
    const svc = createServiceService(fakeRepository(tracker))

    await svc.delete("svc-1", "store-1")

    assert.deepEqual(tracker.deleted, { id: "svc-1", storeId: "store-1" })
  })

  it("throws NotFoundError when the service does not exist", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("missing"), NotFoundError)
    assert.equal(tracker.deleted, null)
  })

  it("throws NotFoundError when the service is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("svc-1", makeService({ deleted_at: new Date() }))
    const svc = createServiceService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("svc-1"), NotFoundError)
  })
})

describe("createServiceService.deleteMany", () => {
  it("returns the deleted count", async () => {
    const tracker = newTracker()
    const svc = createServiceService(fakeRepository(tracker))

    const res = await svc.deleteMany(["a", "b"], "store-1")

    assert.deepEqual(tracker.deletedMany, { ids: ["a", "b"], storeId: "store-1" })
    assert.deepEqual(res, { deleted: 2 })
  })
})