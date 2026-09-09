import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapServiceToResponse } from "../../application/common/services.mappers"
import type { RichService } from "../../application/common/services.mappers"

function makeService(overrides: Record<string, unknown> = {}): RichService {
  return {
    id: "svc-1",
    name: "Corte de Cabello",
    description: "Corte básico",
    base_price: 1500,
    is_active: true,
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    service_products: [
      {
        id: "sp-1",
        product_id: "prod-1",
        quantity: 2,
        product: { id: "prod-1", name: "Shampoo", price: 500 },
      },
      {
        id: "sp-2",
        product_id: "prod-2",
        quantity: 1,
        product: { id: "prod-2", name: "Gel", price: 300 },
      },
    ],
    ...overrides,
  } as RichService
}

describe("services mappers", () => {
  describe("mapServiceToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapServiceToResponse(makeService())
      assert.equal(response.id, "svc-1")
      assert.equal(response.name, "Corte de Cabello")
      assert.equal(response.description, "Corte básico")
      assert.equal(response.base_price, 1500)
      assert.equal(response.is_active, true)
      assert.equal(typeof response.created_at, "string")
      assert.equal(typeof response.updated_at, "string")
    })

    it("converts created_at Date to ISO string", () => {
      const response = mapServiceToResponse(makeService())
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
    })

    it("converts updated_at Date to ISO string", () => {
      const response = mapServiceToResponse(makeService())
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("passes string dates through as-is", () => {
      const response = mapServiceToResponse(makeService({
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-08-30T15:30:00.000Z",
      }))
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("maps products from service_products", () => {
      const response = mapServiceToResponse(makeService())
      assert.equal(response.products.length, 2)
      assert.equal(response.products[0].id, "sp-1")
      assert.equal(response.products[0].product_id, "prod-1")
      assert.equal(response.products[0].product_name, "Shampoo")
      assert.equal(response.products[0].product_price, 500)
      assert.equal(response.products[0].quantity, 2)
      assert.equal(response.products[1].id, "sp-2")
      assert.equal(response.products[1].product_name, "Gel")
      assert.equal(response.products[1].product_price, 300)
      assert.equal(response.products[1].quantity, 1)
    })

    it("returns empty products when service_products is undefined", () => {
      const response = mapServiceToResponse(makeService({ service_products: undefined }))
      assert.deepEqual(response.products, [])
    })

    it("returns empty products when service_products is null", () => {
      const response = mapServiceToResponse(makeService({ service_products: null }))
      assert.deepEqual(response.products, [])
    })

    it("converts base_price from Decimal-like to number", () => {
      const response = mapServiceToResponse(makeService({ base_price: { valueOf: () => "2500" } }))
      assert.equal(response.base_price, 2500)
    })

    it("converts description null to undefined", () => {
      const response = mapServiceToResponse(makeService({ description: null }))
      assert.equal(response.description, undefined)
    })

    it("converts description empty string to undefined", () => {
      const response = mapServiceToResponse(makeService({ description: "" }))
      assert.equal(response.description, undefined)
    })

    it("uses Unknown when product has no name", () => {
      const response = mapServiceToResponse(makeService({
        service_products: [
          { id: "sp-3", product_id: "prod-3", quantity: 1, product: undefined },
        ],
      }))
      assert.equal(response.products[0].product_name, "Unknown")
      assert.equal(response.products[0].product_price, 0)
    })

    it("converts product price from Decimal-like to number", () => {
      const response = mapServiceToResponse(makeService({
        service_products: [
          {
            id: "sp-4",
            product_id: "prod-4",
            quantity: 1,
            product: { id: "prod-4", name: "Item", price: { valueOf: () => "999" } },
          },
        ],
      }))
      assert.equal(response.products[0].product_price, 999)
    })

    it("maps empty service_products array", () => {
      const response = mapServiceToResponse(makeService({ service_products: [] }))
      assert.deepEqual(response.products, [])
    })
  })
})
