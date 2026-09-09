import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapMovementToResponse } from "../../application/common/inventory.mappers"
import type { IInventoryMovementEntity } from "../../domain/inventory.entities"

function makeMovement(overrides: Partial<IInventoryMovementEntity> = {}): IInventoryMovementEntity {
  return {
    id: "mov-1",
    product_id: "prod-1",
    product_name: "Widget",
    movement_type: "entrada",
    quantity: 10,
    unit_cost: 5,
    unit_type: null,
    unit_quantity: null,
    note: null,
    user_id: "user-1",
    batch_id: null,
    store_id: "store-1",
    created_at: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  } as unknown as IInventoryMovementEntity
}

describe("mapMovementToResponse", () => {
  it("converts Date created_at to ISO string", () => {
    const result = mapMovementToResponse(makeMovement())

    assert.equal(result.created_at, "2026-09-01T10:00:00.000Z")
  })

  it("passes created_at through when already a string", () => {
    const result = mapMovementToResponse(makeMovement({ created_at: "2026-09-01T10:00:00Z" as any }))

    assert.equal(result.created_at, "2026-09-01T10:00:00Z")
  })

  it("uses provided productName over movement product_name", () => {
    const result = mapMovementToResponse(makeMovement({ product_name: "Legacy" }), "Fresh")

    assert.equal(result.product_name, "Fresh")
  })

  it("falls back to movement product_name when productName is undefined", () => {
    const result = mapMovementToResponse(makeMovement({ product_name: "Nested" }))

    assert.equal(result.product_name, "Nested")
  })

  it("maps null unit_cost to null", () => {
    const result = mapMovementToResponse(makeMovement({ unit_cost: null }))

    assert.equal(result.unit_cost, null)
  })

  it("maps null note to undefined", () => {
    const result = mapMovementToResponse(makeMovement({ note: null as unknown as string | undefined }))

    assert.equal(result.note, undefined)
  })

  it("keeps note when present", () => {
    const result = mapMovementToResponse(makeMovement({ note: "restock" }))

    assert.equal(result.note, "restock")
  })

  it("keeps unit_cost when present", () => {
    const result = mapMovementToResponse(makeMovement({ unit_cost: 12.5 }))

    assert.equal(result.unit_cost, 12.5)
  })

  it("keeps movement_type and quantity", () => {
    const result = mapMovementToResponse(makeMovement({ movement_type: "salida", quantity: 3 }))

    assert.equal(result.movement_type, "salida")
    assert.equal(result.quantity, 3)
  })
})