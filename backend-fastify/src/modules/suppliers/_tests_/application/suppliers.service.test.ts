import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createSupplierService } from "../../application/suppliers.service"
import type { ISupplierRepository } from "../../domain/suppliers.interface"
import type { ISupplierEntity, CreateSupplierData, UpdateSupplierData } from "../../domain/suppliers.entities"
import { NotFoundError, BadRequestError } from "@/core/errors/AppError"

function makeSupplier(overrides: Partial<ISupplierEntity> = {}): ISupplierEntity {
  const now = new Date("2026-08-01T09:00:00.000Z")
  return {
    id: "sup-1",
    name: "Distribuidora Norte",
    contact_name: "Carlos Pérez",
    email: "carlos@dnorte.com",
    phone: "+5491166662222",
    address: "Av. San Martín 1234",
    notes: "Entrega los lunes",
    is_active: true,
    created_at: now,
    updated_at: now,
    _count: { products: 15 },
    ...overrides,
  } as ISupplierEntity
}

type Tracker = {
  findAll: { params: Parameters<ISupplierRepository["findAll"]>[0]; called: boolean }
  findById: { calls: [string, string | undefined][]; results: Map<string, ISupplierEntity | null> }
  created: { data: CreateSupplierData; storeId: string | undefined } | null
  updated: { id: string; data: UpdateSupplierData; storeId: string | undefined } | null
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

function fakeRepository(tracker: Tracker, overrides: Partial<ISupplierRepository> = {}): ISupplierRepository {
  return {
    findAll: async (params) => {
      tracker.findAll = { params, called: true }
      return { suppliers: [makeSupplier()], total: 1, page: params?.page ?? 1, limit: params?.limit ?? 50 }
    },
    findById: async (id, storeId) => {
      tracker.findById.calls.push([id, storeId])
      return tracker.findById.results.get(id) ?? null
    },
    create: async (data, storeId) => {
      tracker.created = { data, storeId }
      return { ...makeSupplier(), ...data, id: "sup-new" } as ISupplierEntity
    },
    update: async (id, data, storeId) => {
      tracker.updated = { id, data, storeId }
      return { ...makeSupplier(), ...data, id } as ISupplierEntity
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

describe("createSupplierService.list", () => {
  it("maps each supplier to a response and propagates page/limit/total", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    const res = await svc.list({ search: "norte", page: 2, limit: 10, storeId: "store-1" })

    assert.equal(tracker.findAll.called, true)
    assert.deepEqual(tracker.findAll.params, { search: "norte", page: 2, limit: 10, storeId: "store-1" })
    assert.equal(res.total, 1)
    assert.equal(res.page, 2)
    assert.equal(res.limit, 10)
    assert.equal(res.suppliers.length, 1)
    assert.equal(res.suppliers[0].name, "Distribuidora Norte")
    assert.equal(res.suppliers[0].product_count, 15)
  })
})

describe("createSupplierService.getById", () => {
  it("returns the mapped supplier response", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier({ name: "Distribuidora Sur" }))
    const svc = createSupplierService(fakeRepository(tracker))

    const res = await svc.getById("sup-1", "store-1")

    assert.deepEqual(tracker.findById.calls[0], ["sup-1", "store-1"])
    assert.equal(res.name, "Distribuidora Sur")
    assert.equal(res.product_count, 15)
  })

  it("throws NotFoundError when the supplier does not exist", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("missing"), NotFoundError)
  })

  it("throws NotFoundError when the supplier is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier({ deleted_at: new Date() }))
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("sup-1"), NotFoundError)
  })
})

describe("createSupplierService.create", () => {
  const payload: CreateSupplierData = {
    name: "Distribuidora Oeste",
    email: "hola@doeste.com",
  }

  it("creates and returns the mapped supplier, forwarding storeId", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    const res = await svc.create(payload, "store-1")

    assert.deepEqual(tracker.created, { data: payload, storeId: "store-1" })
    assert.equal(res.name, "Distribuidora Oeste")
    assert.equal(res.email, "hola@doeste.com")
    assert.equal(res.is_active, true)
  })

  it("throws BadRequestError when the name is empty", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.create({ name: "" }), BadRequestError)
    assert.equal(tracker.created, null)
  })

  it("throws BadRequestError when the name is only whitespace", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.create({ name: "   " }), BadRequestError)
    assert.equal(tracker.created, null)
  })
})

describe("createSupplierService.update", () => {
  it("updates and returns the mapped supplier", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier())
    const svc = createSupplierService(fakeRepository(tracker))

    const res = await svc.update("sup-1", { contact_name: "Ana López" }, "store-1")

    assert.deepEqual(tracker.updated, { id: "sup-1", data: { contact_name: "Ana López" }, storeId: "store-1" })
    assert.equal(res.contact_name, "Ana López")
  })

  it("throws NotFoundError when the supplier does not exist", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("missing", { name: "X" }), NotFoundError)
    assert.equal(tracker.updated, null)
  })

  it("throws NotFoundError when the supplier is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier({ deleted_at: new Date() }))
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("sup-1", { name: "X" }), NotFoundError)
  })
})

describe("createSupplierService.delete", () => {
  it("soft-deletes an existing supplier", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier())
    const svc = createSupplierService(fakeRepository(tracker))

    await svc.delete("sup-1", "store-1")

    assert.deepEqual(tracker.deleted, { id: "sup-1", storeId: "store-1" })
  })

  it("throws NotFoundError when the supplier does not exist", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("missing"), NotFoundError)
    assert.equal(tracker.deleted, null)
  })

  it("throws NotFoundError when the supplier is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("sup-1", makeSupplier({ deleted_at: new Date() }))
    const svc = createSupplierService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("sup-1"), NotFoundError)
  })
})

describe("createSupplierService.deleteMany", () => {
  it("returns the deleted count", async () => {
    const tracker = newTracker()
    const svc = createSupplierService(fakeRepository(tracker))

    const res = await svc.deleteMany(["a", "b", "c"], "store-1")

    assert.deepEqual(tracker.deletedMany, { ids: ["a", "b", "c"], storeId: "store-1" })
    assert.deepEqual(res, { deleted: 3 })
  })
})