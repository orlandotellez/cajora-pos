import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapSupplierToResponse } from "../../application/common/suppliers.mappers"
import type { RichSupplier } from "../../application/common/suppliers.mappers"

function makeSupplier(overrides: Record<string, unknown> = {}): RichSupplier {
  return {
    id: "sup-1",
    name: "Distribuidora Norte",
    contact_name: "Carlos Pérez",
    email: "carlos@dnorte.com",
    phone: "+5491166662222",
    address: "Av. San Martín 1234",
    notes: "Entrega los lunes",
    is_active: true,
    _count: { products: 15 },
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  } as RichSupplier
}

describe("suppliers mappers", () => {
  describe("mapSupplierToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapSupplierToResponse(makeSupplier())
      assert.equal(response.id, "sup-1")
      assert.equal(response.name, "Distribuidora Norte")
      assert.equal(response.contact_name, "Carlos Pérez")
      assert.equal(response.email, "carlos@dnorte.com")
      assert.equal(response.phone, "+5491166662222")
      assert.equal(response.address, "Av. San Martín 1234")
      assert.equal(response.notes, "Entrega los lunes")
      assert.equal(response.is_active, true)
      assert.equal(response.product_count, 15)
    })

    it("converts created_at Date to ISO string", () => {
      const response = mapSupplierToResponse(makeSupplier())
      assert.equal(typeof response.created_at, "string")
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
    })

    it("converts updated_at Date to ISO string", () => {
      const response = mapSupplierToResponse(makeSupplier())
      assert.equal(typeof response.updated_at, "string")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("passes string dates through as-is", () => {
      const response = mapSupplierToResponse(makeSupplier({
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-08-30T15:30:00.000Z",
      }))
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("converts contact_name null to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ contact_name: null }))
      assert.equal(response.contact_name, undefined)
    })

    it("converts contact_name empty string to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ contact_name: "" }))
      assert.equal(response.contact_name, undefined)
    })

    it("converts email null to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ email: null }))
      assert.equal(response.email, undefined)
    })

    it("converts phone null to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ phone: null }))
      assert.equal(response.phone, undefined)
    })

    it("converts address null to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ address: null }))
      assert.equal(response.address, undefined)
    })

    it("converts notes null to undefined", () => {
      const response = mapSupplierToResponse(makeSupplier({ notes: null }))
      assert.equal(response.notes, undefined)
    })

    it("returns product_count undefined when _count is missing", () => {
      const response = mapSupplierToResponse(makeSupplier({ _count: undefined }))
      assert.equal(response.product_count, undefined)
    })

    it("returns product_count undefined when _count is null", () => {
      const response = mapSupplierToResponse(makeSupplier({ _count: null }))
      assert.equal(response.product_count, undefined)
    })

    it("handles _count with zero products", () => {
      const response = mapSupplierToResponse(makeSupplier({ _count: { products: 0 } }))
      assert.equal(response.product_count, 0)
    })
  })
})
