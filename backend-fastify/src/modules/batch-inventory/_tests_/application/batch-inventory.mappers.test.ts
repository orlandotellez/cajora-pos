import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapBatchToResponse } from "../../application/common/batch-inventory.mappers"
import type { RichBatch, RichBatchItem } from "../../application/common/batch-inventory.mappers"

function makeItem(overrides: Partial<RichBatchItem> = {}): RichBatchItem {
  return {
    id: "item-1",
    product_id: "product-1",
    quantity: 5,
    unit_cost: 120.5,
    notes: "note",
    product: { name: "Producto A" },
    ...overrides,
  }
}

function makeBatch(overrides: Partial<RichBatch> = {}): RichBatch {
  return {
    id: "batch-1",
    movement_type: "inbound",
    supplier_id: "supplier-1",
    notes: "nota",
    user_id: "user-1",
    created_at: new Date("2026-09-01T10:00:00Z"),
    items: [makeItem()],
    supplier: { name: "Proveedor Uno" },
    user: { name: "Usuario Uno" },
    ...overrides,
  }
}

describe("batch-inventory mappers", () => {
  describe("mapBatchToResponse", () => {
    it("mapea los campos principales passthrough", () => {
      const res = mapBatchToResponse(makeBatch())
      assert.equal(res.id, "batch-1")
      assert.equal(res.movement_type, "inbound")
      assert.equal(res.supplier_id, "supplier-1")
      assert.equal(res.supplier_name, "Proveedor Uno")
      assert.equal(res.notes, "nota")
      assert.equal(res.user_id, "user-1")
      assert.equal(res.user_name, "Usuario Uno")
    })

    it("mapea items con sus campos", () => {
      const res = mapBatchToResponse(makeBatch())
      assert.ok(Array.isArray(res.items))
      assert.equal(res.items!.length, 1)
      assert.equal(res.items![0].id, "item-1")
      assert.equal(res.items![0].product_id, "product-1")
      assert.equal(res.items![0].product_name, "Producto A")
      assert.equal(res.items![0].quantity, 5)
      assert.equal(res.items![0].unit_cost, 120.5)
      assert.equal(res.items![0].notes, "note")
    })

    it("calcula total_items y total_quantity", () => {
      const res = mapBatchToResponse(makeBatch({
        items: [
          makeItem({ id: "i1", quantity: 3 }),
          makeItem({ id: "i2", quantity: 4 }),
        ],
      }))
      assert.equal(res.total_items, 2)
      assert.equal(res.total_quantity, 7)
    })

    it("suma correctamente quantity cuando hay muchos items", () => {
      const res = mapBatchToResponse(makeBatch({
        items: [
          makeItem({ id: "i1", quantity: 1 }),
          makeItem({ id: "i2", quantity: 1 }),
          makeItem({ id: "i3", quantity: 3 }),
        ],
      }))
      assert.equal(res.total_quantity, 5)
    })

    it("convierte unit_cost a Number", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ unit_cost: "99.9" as unknown as number })] }))
      assert.equal(res.items![0].unit_cost, 99.9)
    })

    it("deja unit_cost como null cuando es falsy", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ unit_cost: 0 })] }))
      assert.equal(res.items![0].unit_cost, null)
    })

    it("deja unit_cost como null cuando es undefined", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ unit_cost: undefined })] }))
      assert.equal(res.items![0].unit_cost, null)
    })

    it("deja product_name como undefined cuando falta product", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ product: undefined })] }))
      assert.equal(res.items![0].product_name, undefined)
    })

    it("deja notes como null cuando es falsy", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ notes: "" })] }))
      assert.equal(res.items![0].notes, null)
    })

    it("deja notes como null cuando es undefined", () => {
      const res = mapBatchToResponse(makeBatch({ items: [makeItem({ notes: undefined })] }))
      assert.equal(res.items![0].notes, null)
    })

    it("convierte created_at Date a ISO string", () => {
      const res = mapBatchToResponse(makeBatch())
      assert.equal(typeof res.created_at, "string")
      assert.equal(res.created_at, "2026-09-01T10:00:00.000Z")
    })

    it("pasa created_at string tal cual cuando no es Date", () => {
      const res = mapBatchToResponse(makeBatch({ created_at: "2026-09-01T10:00:00.000Z" as unknown as Date }))
      assert.equal(res.created_at, "2026-09-01T10:00:00.000Z")
    })

    it("deja items vacio cuando no hay items", () => {
      const res = mapBatchToResponse(makeBatch({ items: [] }))
      assert.deepEqual(res.items, [])
      assert.equal(res.total_items, 0)
      assert.equal(res.total_quantity, 0)
    })

    it("trata items undefined como vacio", () => {
      const res = mapBatchToResponse(makeBatch({ items: undefined }))
      assert.deepEqual(res.items, [])
      assert.equal(res.total_items, 0)
      assert.equal(res.total_quantity, 0)
    })

    it("deja supplier_id como null cuando es null", () => {
      const res = mapBatchToResponse(makeBatch({ supplier_id: null }))
      assert.equal(res.supplier_id, null)
    })

    it("deja supplier_id como null cuando es undefined", () => {
      const res = mapBatchToResponse(makeBatch({ supplier_id: undefined }))
      assert.equal(res.supplier_id, null)
    })

    it("deja supplier_name como undefined cuando falta supplier", () => {
      const res = mapBatchToResponse(makeBatch({ supplier: null }))
      assert.equal(res.supplier_name, undefined)
    })

    it("deja notes como null cuando es null", () => {
      const res = mapBatchToResponse(makeBatch({ notes: null }))
      assert.equal(res.notes, null)
    })

    it("deja user_name como undefined cuando falta user", () => {
      const res = mapBatchToResponse(makeBatch({ user: null }))
      assert.equal(res.user_name, undefined)
    })
  })
})
