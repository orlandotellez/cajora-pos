import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapCategoryToResponse } from "../../application/common/categories.mappers"
import type { RichCategory } from "../../application/common/categories.mappers"

function makeCategory(overrides: Record<string, unknown> = {}): RichCategory {
  return {
    id: "cat-1",
    name: "Bebidas",
    description: "Gaseosas, jugos y aguas",
    _count: { products: 25 },
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  } as RichCategory
}

describe("categories mappers", () => {
  describe("mapCategoryToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapCategoryToResponse(makeCategory())
      assert.equal(response.id, "cat-1")
      assert.equal(response.name, "Bebidas")
      assert.equal(response.description, "Gaseosas, jugos y aguas")
      assert.equal(response.product_count, 25)
    })

    it("converts created_at Date to ISO string", () => {
      const response = mapCategoryToResponse(makeCategory())
      assert.equal(typeof response.created_at, "string")
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
    })

    it("converts updated_at Date to ISO string", () => {
      const response = mapCategoryToResponse(makeCategory())
      assert.equal(typeof response.updated_at, "string")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("passes string dates through as-is", () => {
      const response = mapCategoryToResponse(makeCategory({
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-08-30T15:30:00.000Z",
      }))
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("converts description null to undefined", () => {
      const response = mapCategoryToResponse(makeCategory({ description: null }))
      assert.equal(response.description, undefined)
    })

    it("converts description empty string to undefined", () => {
      const response = mapCategoryToResponse(makeCategory({ description: "" }))
      assert.equal(response.description, undefined)
    })

    it("returns product_count undefined when _count is missing", () => {
      const response = mapCategoryToResponse(makeCategory({ _count: undefined }))
      assert.equal(response.product_count, undefined)
    })

    it("returns product_count undefined when _count is null", () => {
      const response = mapCategoryToResponse(makeCategory({ _count: null }))
      assert.equal(response.product_count, undefined)
    })

    it("handles _count with zero products", () => {
      const response = mapCategoryToResponse(makeCategory({ _count: { products: 0 } }))
      assert.equal(response.product_count, 0)
    })
  })
})
