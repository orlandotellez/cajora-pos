import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapUserToResponse } from "../../application/common/users.mappers"
import type { IUserEntity } from "../../domain/users.entities"

function makeUser(overrides: Record<string, unknown> = {}): IUserEntity {
  return {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    email_verified: true,
    role: "admin",
    is_owner: true,
    is_active: true,
    permissions: ["catalog_read", "settings"],
    phone: "+5491155551234",
    image: "https://example.com/img.jpg",
    store_id: "store-1",
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

describe("users mappers", () => {
  describe("mapUserToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapUserToResponse(makeUser())
      assert.equal(response.id, "user-1")
      assert.equal(response.name, "John Doe")
      assert.equal(response.email, "john@example.com")
      assert.equal(response.email_verified, true)
      assert.equal(response.role, "admin")
      assert.equal(response.is_owner, true)
      assert.equal(response.is_active, true)
      assert.deepEqual(response.permissions, ["catalog_read", "settings"])
      assert.equal(response.phone, "+5491155551234")
      assert.equal(response.image, "https://example.com/img.jpg")
    })

    it("returns created_at and updated_at as Date", () => {
      const created = new Date("2026-08-01T09:00:00Z")
      const updated = new Date("2026-08-30T15:30:00Z")
      const response = mapUserToResponse(makeUser({ created_at: created, updated_at: updated }))
      assert.ok(response.created_at instanceof Date)
      assert.ok(response.updated_at instanceof Date)
      assert.equal(response.created_at.toISOString(), created.toISOString())
      assert.equal(response.updated_at.toISOString(), updated.toISOString())
    })

    it("defaults is_owner to false when null", () => {
      const response = mapUserToResponse(makeUser({ is_owner: null }))
      assert.equal(response.is_owner, false)
    })

    it("defaults is_owner to false when undefined", () => {
      const response = mapUserToResponse(makeUser({ is_owner: undefined }))
      assert.equal(response.is_owner, false)
    })

    it("defaults is_active to true when null", () => {
      const response = mapUserToResponse(makeUser({ is_active: null }))
      assert.equal(response.is_active, true)
    })

    it("defaults is_active to true when undefined", () => {
      const response = mapUserToResponse(makeUser({ is_active: undefined }))
      assert.equal(response.is_active, true)
    })

    it("defaults permissions to empty array when null", () => {
      const response = mapUserToResponse(makeUser({ permissions: null }))
      assert.deepEqual(response.permissions, [])
    })

    it("defaults permissions to empty array when undefined", () => {
      const response = mapUserToResponse(makeUser({ permissions: undefined }))
      assert.deepEqual(response.permissions, [])
    })

    it("converts phone null to undefined", () => {
      const response = mapUserToResponse(makeUser({ phone: null }))
      assert.equal(response.phone, undefined)
    })

    it("converts phone empty string to undefined", () => {
      const response = mapUserToResponse(makeUser({ phone: "" }))
      assert.equal(response.phone, undefined)
    })

    it("converts image null to undefined", () => {
      const response = mapUserToResponse(makeUser({ image: null }))
      assert.equal(response.image, undefined)
    })

    it("converts image empty string to undefined", () => {
      const response = mapUserToResponse(makeUser({ image: "" }))
      assert.equal(response.image, undefined)
    })

    it("coerces string created_at to Date", () => {
      const response = mapUserToResponse(makeUser({
        created_at: "2026-08-01T09:00:00.000Z" as unknown as Date,
      }))
      assert.ok(response.created_at instanceof Date)
      assert.equal(response.created_at.toISOString(), "2026-08-01T09:00:00.000Z")
    })

    it("coerces string updated_at to Date", () => {
      const response = mapUserToResponse(makeUser({
        updated_at: "2026-08-30T15:30:00.000Z" as unknown as Date,
      }))
      assert.ok(response.updated_at instanceof Date)
      assert.equal(response.updated_at.toISOString(), "2026-08-30T15:30:00.000Z")
    })
  })
})
