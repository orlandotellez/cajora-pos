import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapProductToResponse, type RichProductEntity } from "../../application/common/products.mappers"

function decimal(value: number) {
  return { toString: () => String(value) } as unknown as RichProductEntity["price"]
}

function richEntity(overrides: Partial<RichProductEntity> = {}): RichProductEntity {
  return {
    id: "prod-1",
    barcode: "7500000000001",
    name: "Coca Cola",
    unit_type: "botella",
    unit_quantity: 1.5,
    category_id: "cat-1",
    supplier_id: "sup-1",
    category: { id: "cat-1", name: "Bebidas" },
    supplier: { id: "sup-1", name: "Distribuidora Uno" },
    price: decimal(18.5),
    cost: decimal(12),
    stock: 100,
    low_stock_threshold: 10,
    active: true,
    created_at: new Date("2024-01-01T00:00:00.000Z"),
    updated_at: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  }
}

describe("mapProductToResponse", () => {
  it("maps a complete entity with category and supplier", () => {
    const res = mapProductToResponse(richEntity())

    assert.equal(res.id, "prod-1")
    assert.equal(res.barcode, "7500000000001")
    assert.equal(res.name, "Coca Cola")
    assert.equal(res.unit_type, "botella")
    assert.equal(res.unit_quantity, 1.5)
    assert.deepEqual(res.category, { id: "cat-1", name: "Bebidas" })
    assert.deepEqual(res.supplier, { id: "sup-1", name: "Distribuidora Uno" })
    assert.equal(res.price, 18.5)
    assert.equal(res.cost, 12)
    assert.equal(res.stock, 100)
    assert.equal(res.low_stock_threshold, 10)
    assert.equal(res.active, true)
    assert.equal(res.created_at, "2024-01-01T00:00:00.000Z")
    assert.equal(res.updated_at, "2024-01-02T00:00:00.000Z")
  })

  it("converts Decimal-ish price and cost to numbers", () => {
    const res = mapProductToResponse(
      richEntity({ price: decimal(9.99), cost: decimal(7.5) }),
    )

    assert.equal(res.price, 9.99)
    assert.equal(res.cost, 7.5)
  })

  it("serializes Date timestamps to ISO strings", () => {
    const res = mapProductToResponse(richEntity())

    assert.equal(typeof res.created_at, "string")
    assert.equal(typeof res.updated_at, "string")
  })

  it("keeps timestamps that are already strings", () => {
    const res = mapProductToResponse(
      richEntity({ created_at: "2024-01-01T00:00:00.000Z" as unknown as Date, updated_at: "2024-01-02T00:00:00.000Z" as unknown as Date }),
    )

    assert.equal(res.created_at, "2024-01-01T00:00:00.000Z")
    assert.equal(res.updated_at, "2024-01-02T00:00:00.000Z")
  })

  it("maps null category and supplier to undefined", () => {
    const res = mapProductToResponse(richEntity({ category: null, supplier: null }))

    assert.equal(res.category, undefined)
    assert.equal(res.supplier, undefined)
  })

  it("maps empty optional fields to undefined", () => {
    const res = mapProductToResponse(
      richEntity({
        barcode: "",
        unit_type: "",
        unit_quantity: undefined,
      }),
    )

    assert.equal(res.barcode, undefined)
    assert.equal(res.unit_type, undefined)
    assert.equal(res.unit_quantity, undefined)
  })

  it("keeps unit_quantity 0 instead of dropping it", () => {
    const res = mapProductToResponse(richEntity({ unit_quantity: 0 }))

    assert.equal(res.unit_quantity, 0)
  })
})