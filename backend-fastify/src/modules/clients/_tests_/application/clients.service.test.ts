import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createClientService } from "../../application/client.service"
import type { IClientRepository } from "../../domain/client.interface"
import type { IClientEntity, CreateClientData, UpdateClientData } from "../../domain/client.entities"
import { NotFoundError, BadRequestError } from "@/core/errors/AppError"

function makeClient(overrides: Partial<IClientEntity> = {}): IClientEntity {
  const now = new Date("2026-08-01T09:00:00.000Z")
  return {
    id: "cli-1",
    name: "María García",
    phone: "+5491177773333",
    email: "maria@example.com",
    address: "Calle Falsa 456",
    notes: "Cliente frecuente",
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

type RecentSale = Awaited<ReturnType<IClientRepository["getRecentSales"]>>[number]

type Tracker = {
  findAll: { params: Parameters<IClientRepository["findAll"]>[0]; called: boolean }
  findById: { calls: [string, string | undefined][]; results: Map<string, IClientEntity | null> }
  findByPhone: { calls: [string, string | undefined][]; results: Map<string, IClientEntity | null> }
  created: { data: CreateClientData; storeId: string | undefined } | null
  updated: { id: string; data: UpdateClientData; storeId: string | undefined } | null
  deleted: { id: string; storeId: string | undefined } | null
  deletedMany: { ids: string[]; storeId: string | undefined } | null
}

function newTracker(): Tracker {
  return {
    findAll: { params: undefined, called: false },
    findById: { calls: [], results: new Map() },
    findByPhone: { calls: [], results: new Map() },
    created: null,
    updated: null,
    deleted: null,
    deletedMany: null,
  }
}

function fakeRepository(tracker: Tracker, overrides: Partial<IClientRepository> = {}): IClientRepository {
  return {
    findAll: async (params) => {
      tracker.findAll = { params, called: true }
      return { clients: [makeClient()], total: 1, page: params?.page ?? 1, limit: params?.limit ?? 50 }
    },
    findById: async (id, storeId) => {
      tracker.findById.calls.push([id, storeId])
      return tracker.findById.results.get(id) ?? null
    },
    findByPhone: async (phone, storeId) => {
      tracker.findByPhone.calls.push([phone, storeId])
      return tracker.findByPhone.results.get(phone) ?? null
    },
    create: async (data, storeId) => {
      tracker.created = { data, storeId }
      return { ...makeClient(), ...data, id: "cli-new" }
    },
    update: async (id, data, storeId) => {
      tracker.updated = { id, data, storeId }
      return { ...makeClient(), ...data, id }
    },
    softDelete: async (id, storeId) => {
      tracker.deleted = { id, storeId }
    },
    softDeleteMany: async (ids, storeId) => {
      tracker.deletedMany = { ids, storeId }
      return { count: ids.length }
    },
    getSaleCount: async () => 0,
    getTotalSpent: async () => 0,
    getRecentSales: async () => [],
    ...overrides,
  }
}

describe("createClientService.list", () => {
  it("maps each client to a response and propagates page/limit/total", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.list({ search: "maria", page: 2, limit: 10, storeId: "store-1" })

    assert.equal(tracker.findAll.called, true)
    assert.deepEqual(tracker.findAll.params, { search: "maria", page: 2, limit: 10, storeId: "store-1" })
    assert.equal(res.total, 1)
    assert.equal(res.page, 2)
    assert.equal(res.limit, 10)
    assert.equal(res.clients.length, 1)
    assert.equal(res.clients[0].name, "María García")
    assert.equal(res.clients[0].phone, "+5491177773333")
  })
})

describe("createClientService.getById", () => {
  it("returns the detail with sale stats and recent sales", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient())
    const recent: RecentSale[] = [
      {
        id: "sale-1",
        total: 2500,
        payment_method: "efectivo",
        created_at: new Date("2026-09-01T12:00:00.000Z"),
        items: [{ name: "Coca Cola", quantity: 2, line_total: 1500 }],
        service_items: [{ name: "Corte de Cabello", quantity: 1, line_total: 1000 }],
      },
    ]
    const svc = createClientService(
      fakeRepository(tracker, {
        getSaleCount: async () => 5,
        getTotalSpent: async () => 12500,
        getRecentSales: async () => recent,
      }),
    )

    const res = await svc.getById("cli-1", "store-1")

    assert.deepEqual(tracker.findById.calls[0], ["cli-1", "store-1"])
    assert.equal(res.name, "María García")
    assert.equal(res.sale_count, 5)
    assert.equal(res.total_spent, 12500)
    assert.equal(res.recent_sales.length, 1)
    assert.equal(res.recent_sales[0].id, "sale-1")
    assert.equal(res.recent_sales[0].total, 2500)
    assert.equal(res.recent_sales[0].created_at, "2026-09-01T12:00:00.000Z")
    assert.deepEqual(res.recent_sales[0].items, [{ name: "Coca Cola", quantity: 2, line_total: 1500 }])
    assert.deepEqual(res.recent_sales[0].service_items, [{ name: "Corte de Cabello", quantity: 1, line_total: 1000 }])
  })

  it("throws NotFoundError when the client does not exist", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("missing"), NotFoundError)
  })

  it("throws NotFoundError when the client is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient({ deleted_at: new Date() }))
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.getById("cli-1"), NotFoundError)
  })
})

describe("createClientService.findByPhone", () => {
  it("returns null when the phone has no match", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.findByPhone("+5491100000000", "store-1")

    assert.equal(res, null)
    assert.deepEqual(tracker.findByPhone.calls[0], ["+5491100000000", "store-1"])
  })

  it("returns null when the matched client is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findByPhone.results.set("+5491100000000", makeClient({ deleted_at: new Date() }))
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.findByPhone("+5491100000000")

    assert.equal(res, null)
  })

  it("returns the mapped client when found", async () => {
    const tracker = newTracker()
    tracker.findByPhone.results.set("+5491177773333", makeClient())
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.findByPhone("+5491177773333")

    assert.equal(res?.name, "María García")
    assert.equal(res?.phone, "+5491177773333")
  })
})

describe("createClientService.create", () => {
  const payload: CreateClientData = {
    name: "Juan Pérez",
    phone: "+5491188884444",
  }

  it("creates and returns the mapped client, forwarding storeId", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.create(payload, "store-1")

    assert.deepEqual(tracker.created, { data: payload, storeId: "store-1" })
    assert.equal(res.name, "Juan Pérez")
    assert.equal(res.is_active, true)
  })

  it("throws BadRequestError when the name is empty", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.create({ name: "" }), BadRequestError)
    assert.equal(tracker.created, null)
  })

  it("throws BadRequestError when the name is only whitespace", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.create({ name: "   " }), BadRequestError)
    assert.equal(tracker.created, null)
  })

  it("throws BadRequestError when the phone already exists in the store", async () => {
    const tracker = newTracker()
    tracker.findByPhone.results.set(payload.phone!, makeClient({ id: "cli-other" }))
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.create(payload, "store-1"), BadRequestError)
    assert.equal(tracker.created, null)
  })

  it("skips the duplicate check when no storeId is provided", async () => {
    const tracker = newTracker()
    tracker.findByPhone.results.set(payload.phone!, makeClient({ id: "cli-other" }))
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.create(payload)

    assert.deepEqual(tracker.findByPhone.calls, [])
    assert.equal(res.name, "Juan Pérez")
  })

  it("creates without a phone without checking duplicates", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.create({ name: "Sin Teléfono" }, "store-1")

    assert.deepEqual(tracker.findByPhone.calls, [])
    assert.equal(res.name, "Sin Teléfono")
  })
})

describe("createClientService.update", () => {
  it("updates and returns the mapped client", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient())
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.update("cli-1", { address: "Nueva 789" }, "store-1")

    assert.deepEqual(tracker.updated, { id: "cli-1", data: { address: "Nueva 789" }, storeId: "store-1" })
    assert.equal(res.address, "Nueva 789")
  })

  it("throws NotFoundError when the client does not exist", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("missing", { name: "X" }), NotFoundError)
    assert.equal(tracker.updated, null)
  })

  it("throws NotFoundError when the client is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient({ deleted_at: new Date() }))
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("cli-1", { name: "X" }), NotFoundError)
  })

  it("throws BadRequestError when the new phone belongs to another client", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient({ id: "cli-1", phone: "+5491177773333" }))
    tracker.findByPhone.results.set("+5491188884444", makeClient({ id: "cli-2", phone: "+5491188884444" }))
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.update("cli-1", { phone: "+5491188884444" }, "store-1"), BadRequestError)
    assert.equal(tracker.updated, null)
  })

  it("allows keeping the same phone without conflict", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient({ id: "cli-1", phone: "+5491177773333" }))
    tracker.findByPhone.results.set("+5491177773333", makeClient({ id: "cli-1", phone: "+5491177773333" }))
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.update("cli-1", { phone: "+5491177773333" }, "store-1")

    assert.equal(res.phone, "+5491177773333")
  })
})

describe("createClientService.delete", () => {
  it("soft-deletes an existing client", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient())
    const svc = createClientService(fakeRepository(tracker))

    await svc.delete("cli-1", "store-1")

    assert.deepEqual(tracker.deleted, { id: "cli-1", storeId: "store-1" })
  })

  it("throws NotFoundError when the client does not exist", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("missing"), NotFoundError)
    assert.equal(tracker.deleted, null)
  })

  it("throws NotFoundError when the client is soft-deleted", async () => {
    const tracker = newTracker()
    tracker.findById.results.set("cli-1", makeClient({ deleted_at: new Date() }))
    const svc = createClientService(fakeRepository(tracker))

    await assert.rejects(() => svc.delete("cli-1"), NotFoundError)
  })
})

describe("createClientService.deleteMany", () => {
  it("returns the deleted count", async () => {
    const tracker = newTracker()
    const svc = createClientService(fakeRepository(tracker))

    const res = await svc.deleteMany(["a", "b"], "store-1")

    assert.deepEqual(tracker.deletedMany, { ids: ["a", "b"], storeId: "store-1" })
    assert.deepEqual(res, { deleted: 2 })
  })
})