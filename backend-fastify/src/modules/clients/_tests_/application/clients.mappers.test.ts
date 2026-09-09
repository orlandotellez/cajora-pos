import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapClientToResponse } from "../../application/common/clients.mappers"
import type { RichClient } from "../../application/common/clients.mappers"

function makeClient(overrides: Record<string, unknown> = {}): RichClient {
  return {
    id: "cli-1",
    name: "María García",
    phone: "+5491177773333",
    email: "maria@example.com",
    address: "Calle Falsa 456",
    notes: "Cliente frecuente",
    is_active: true,
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  } as RichClient
}

describe("clients mappers", () => {
  describe("mapClientToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapClientToResponse(makeClient())
      assert.equal(response.id, "cli-1")
      assert.equal(response.name, "María García")
      assert.equal(response.phone, "+5491177773333")
      assert.equal(response.email, "maria@example.com")
      assert.equal(response.address, "Calle Falsa 456")
      assert.equal(response.notes, "Cliente frecuente")
      assert.equal(response.is_active, true)
    })

    it("converts created_at Date to ISO string", () => {
      const response = mapClientToResponse(makeClient())
      assert.equal(typeof response.created_at, "string")
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
    })

    it("converts updated_at Date to ISO string", () => {
      const response = mapClientToResponse(makeClient())
      assert.equal(typeof response.updated_at, "string")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("passes string dates through as-is", () => {
      const response = mapClientToResponse(makeClient({
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-08-30T15:30:00.000Z",
      }))
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("converts phone null to undefined", () => {
      const response = mapClientToResponse(makeClient({ phone: null }))
      assert.equal(response.phone, undefined)
    })

    it("converts phone empty string to undefined", () => {
      const response = mapClientToResponse(makeClient({ phone: "" }))
      assert.equal(response.phone, undefined)
    })

    it("converts email null to undefined", () => {
      const response = mapClientToResponse(makeClient({ email: null }))
      assert.equal(response.email, undefined)
    })

    it("converts address null to undefined", () => {
      const response = mapClientToResponse(makeClient({ address: null }))
      assert.equal(response.address, undefined)
    })

    it("converts notes null to undefined", () => {
      const response = mapClientToResponse(makeClient({ notes: null }))
      assert.equal(response.notes, undefined)
    })

    it("maps sale_count and total_spent from extra", () => {
      const response = mapClientToResponse(makeClient(), { sale_count: 5, total_spent: 12500 })
      assert.equal(response.sale_count, 5)
      assert.equal(response.total_spent, 12500)
    })

    it("returns sale_count and total_spent undefined when extra is missing", () => {
      const response = mapClientToResponse(makeClient())
      assert.equal(response.sale_count, undefined)
      assert.equal(response.total_spent, undefined)
    })

    it("returns sale_count and total_spent undefined when extra has no values", () => {
      const response = mapClientToResponse(makeClient(), {})
      assert.equal(response.sale_count, undefined)
      assert.equal(response.total_spent, undefined)
    })

    it("returns sale_count undefined when extra.sale_count is undefined", () => {
      const response = mapClientToResponse(makeClient(), { total_spent: 500 })
      assert.equal(response.sale_count, undefined)
      assert.equal(response.total_spent, 500)
    })
  })
})
