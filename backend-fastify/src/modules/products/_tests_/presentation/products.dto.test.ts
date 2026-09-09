import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  CreateProductDtoSchema,
  UpdateProductDtoSchema,
  ImportProductRowSchema,
  ImportProductsDtoSchema,
  BulkDeleteProductsDtoSchema,
  ProductQuerySchema,
} from "../../presentation/products.dto"

describe("CreateProductDtoSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = CreateProductDtoSchema.parse({ name: "Product", price: 10 })
    assert.equal(parsed.name, "Product")
    assert.equal(parsed.price, 10)
  })

  it("accepts a full payload", () => {
    const parsed = CreateProductDtoSchema.parse({
      barcode: "123",
      name: "Product",
      unit_type: "caja",
      unit_quantity: 6,
      price: 20,
      cost: 10,
      stock: 5,
      low_stock_threshold: 2,
      active: true,
    })
    assert.equal(parsed.unit_quantity, 6)
    assert.equal(parsed.active, true)
  })

  it("rejects an empty name", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "", price: 10 }),
      /Name is required/,
    )
  })

  it("rejects a non-positive price", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", price: 0 }),
      /Price must be positive/,
    )
  })

  it("rejects a negative cost", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", price: 10, cost: -1 }),
      /cost/,
    )
  })

  it("rejects a negative stock", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", price: 10, stock: -2 }),
      /stock/,
    )
  })

  it("rejects loose units with a unit_quantity (PACKAGING rule)", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", unit_type: "unidad", unit_quantity: 2, price: 10 }),
      /Empaque inválido/,
    )
  })

  it("rejects packaged units with unit_quantity below 2", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", unit_type: "caja", unit_quantity: 1, price: 10 }),
      /Empaque inválido/,
    )
  })

  it("accepts packaged units with unit_quantity 2 or more", () => {
    const parsed = CreateProductDtoSchema.parse({ name: "Product", unit_type: "caja", unit_quantity: 6, price: 10 })
    assert.equal(parsed.unit_quantity, 6)
  })

  it("rejects a non-uuid category_id", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", price: 10, category_id: "no-uuid" }),
      /category_id/,
    )
  })

  it("rejects a unit_type outside the enum", () => {
    assert.throws(
      () => CreateProductDtoSchema.parse({ name: "Product", unit_type: "galón", price: 10 }),
      /unit_type/,
    )
  })
})

describe("UpdateProductDtoSchema", () => {
  it("accepts an empty body for partial updates", () => {
    const parsed = UpdateProductDtoSchema.parse({})
    assert.deepEqual(parsed, {})
  })

  it("accepts nullable barcode and unit_type", () => {
    const parsed = UpdateProductDtoSchema.parse({ barcode: null, unit_type: null })
    assert.equal(parsed.barcode, null)
    assert.equal(parsed.unit_type, null)
  })

  it("rejects an empty name when provided", () => {
    assert.throws(
      () => UpdateProductDtoSchema.parse({ name: "" }),
      /at least 1 character/,
    )
  })

  it("rejects a non-positive price", () => {
    assert.throws(
      () => UpdateProductDtoSchema.parse({ price: -5 }),
      /price/,
    )
  })

  it("applies the packaging rule", () => {
    assert.throws(
      () => UpdateProductDtoSchema.parse({ unit_type: "caja", unit_quantity: 1 }),
      /Empaque inválido/,
    )
  })
})

describe("ImportProductRowSchema", () => {
  it("accepts a valid row", () => {
    const parsed = ImportProductRowSchema.parse({ name: "Product", price: 10 })
    assert.equal(parsed.name, "Product")
  })

  it("accepts category_name and supplier_name", () => {
    const parsed = ImportProductRowSchema.parse({
      name: "Product",
      price: 10,
      category_name: "Bebidas",
      supplier_name: "Supplier",
    })
    assert.equal(parsed.category_name, "Bebidas")
    assert.equal(parsed.supplier_name, "Supplier")
  })

  it("rejects a row without a name", () => {
    assert.throws(() => ImportProductRowSchema.parse({ price: 10 }), /Required/)
  })

  it("rejects a row with an empty name", () => {
    assert.throws(() => ImportProductRowSchema.parse({ name: "", price: 10 }), /Name is required/)
  })

  it("rejects a row without a price", () => {
    assert.throws(() => ImportProductRowSchema.parse({ name: "Product" }), /Required/)
  })

  it("rejects a row with a non-positive price", () => {
    assert.throws(() => ImportProductRowSchema.parse({ name: "Product", price: 0 }), /Price must be positive/)
  })

  it("applies the packaging rule", () => {
    assert.throws(
      () => ImportProductRowSchema.parse({ name: "Product", unit_type: "bolsa", unit_quantity: 1, price: 10 }),
      /Empaque inválido/,
    )
  })
})

describe("ImportProductsDtoSchema", () => {
  it("accepts a non-empty list", () => {
    const parsed = ImportProductsDtoSchema.parse({ rows: [{ name: "A" }, { name: "B" }] })
    assert.equal(parsed.rows.length, 2)
  })

  it("rejects an empty rows list", () => {
    assert.throws(() => ImportProductsDtoSchema.parse({ rows: [] }), /At least one product is required/)
  })

  it("rejects more than 500 rows", () => {
    const rows = Array.from({ length: 501 }, () => ({}))
    assert.throws(() => ImportProductsDtoSchema.parse({ rows }), /Maximum 500 products/)
  })
})

describe("BulkDeleteProductsDtoSchema", () => {
  it("accepts valid uuid ids", () => {
    const parsed = BulkDeleteProductsDtoSchema.parse({ ids: ["00000000-0000-4000-8000-000000000001"] })
    assert.equal(parsed.ids.length, 1)
  })

  it("rejects non-uuid ids", () => {
    assert.throws(() => BulkDeleteProductsDtoSchema.parse({ ids: ["abc"] }), /ids/)
  })

  it("rejects an empty list", () => {
    assert.throws(() => BulkDeleteProductsDtoSchema.parse({ ids: [] }), /At least one product is required/)
  })
})

describe("ProductQuerySchema", () => {
  it("accepts an empty query", () => {
    const parsed = ProductQuerySchema.parse({})
    assert.deepEqual(parsed, {})
  })

  it("coerces booleans and numbers from strings", () => {
    const parsed = ProductQuerySchema.parse({ active: "true", page: "3", limit: "20", low_stock: true })
    assert.equal(parsed.active, true)
    assert.equal(parsed.low_stock, true)
    assert.equal(parsed.page, 3)
    assert.equal(parsed.limit, 20)
  })

  it("rejects a non-integer page", () => {
    assert.throws(() => ProductQuerySchema.parse({ page: "abc" }), /page/)
  })

  it("rejects a limit above 100", () => {
    assert.throws(() => ProductQuerySchema.parse({ limit: "101" }), /limit/)
  })
})