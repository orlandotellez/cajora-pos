import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapUserToResponse, mapStoreToResponse } from "../../application/common/auth.mappers"
import type { IUserEntity } from "../../domain/auth.entities"

function makeUser(overrides: Partial<IUserEntity> = {}): IUserEntity {
  const now = new Date("2026-01-01T00:00:00.000Z")
  return {
    id: "user-1",
    name: "Ana",
    email: "ana@cajorapos.com",
    email_verified: true,
    role: "admin",
    is_owner: true,
    is_active: true,
    permissions: ["reports", "settings"],
    store_id: "store-1",
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe("mapUserToResponse", () => {
  it("maps all fields from the entity", () => {
    const user = makeUser()
    const res = mapUserToResponse(user)

    assert.equal(res.id, "user-1")
    assert.equal(res.name, "Ana")
    assert.equal(res.email, "ana@cajorapos.com")
    assert.equal(res.email_verified, true)
    assert.equal(res.role, "admin")
    assert.equal(res.is_owner, true)
    assert.equal(res.is_active, true)
    assert.deepEqual(res.permissions, ["reports", "settings"])
    assert.equal(res.store_id, "store-1")
  })

  it("passes Date fields through unchanged", () => {
    const created = new Date("2026-05-10T10:20:30.000Z")
    const updated = new Date("2026-05-11T00:00:00.000Z")
    const res = mapUserToResponse(makeUser({ created_at: created, updated_at: updated }))

    assert.equal(res.created_at, created)
    assert.equal(res.updated_at, updated)
  })

  it("defaults optional booleans and permissions when undefined", () => {
    const user = makeUser({
      is_owner: undefined as unknown as boolean,
      is_active: undefined as unknown as boolean,
      permissions: undefined as unknown as IUserEntity["permissions"],
    })
    const res = mapUserToResponse(user)

    assert.equal(res.is_owner, false)
    assert.equal(res.is_active, true)
    assert.deepEqual(res.permissions, [])
  })

  it("keeps null and optional fields null-safe", () => {
    const user = makeUser({
      phone: "123456",
      image: "https://img/ana.png",
      store_id: null,
    })
    const res = mapUserToResponse(user)

    assert.equal(res.phone, "123456")
    assert.equal(res.image, "https://img/ana.png")
    assert.equal(res.store_id, null)
  })

  it("leaves phone and image undefined when absent", () => {
    const res = mapUserToResponse(makeUser())
    assert.equal(res.phone, undefined)
    assert.equal(res.image, undefined)
  })
})

describe("mapStoreToResponse", () => {
  it("maps id, name, address and phone", () => {
    const res = mapStoreToResponse({ id: "store-1", name: "Tienda", address: "Calle 1", phone: "123" })

    assert.equal(res.id, "store-1")
    assert.equal(res.name, "Tienda")
    assert.equal(res.address, "Calle 1")
    assert.equal(res.phone, "123")
  })

  it("omits address and phone when null", () => {
    const res = mapStoreToResponse({ id: "store-1", name: "Tienda", address: null, phone: null })

    assert.equal(res.address, undefined)
    assert.equal(res.phone, undefined)
  })

  it("omits address and phone when empty string", () => {
    const res = mapStoreToResponse({ id: "store-1", name: "Tienda", address: "", phone: "" })

    assert.equal(res.address, undefined)
    assert.equal(res.phone, undefined)
  })

  it("omits optional address and phone when undefined", () => {
    const res = mapStoreToResponse({ id: "store-1", name: "Tienda" })

    assert.equal(res.address, undefined)
    assert.equal(res.phone, undefined)
  })
})
