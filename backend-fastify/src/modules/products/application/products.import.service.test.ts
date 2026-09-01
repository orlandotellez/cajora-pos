import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createProductService } from "./products.service"
import type { IProductRepository } from "../domain/products.interface"
import type { CreateProductData } from "../domain/products.entities"
import type { ImportProductRowDto } from "../presentation/products.dto"

interface FakeState {
  existingBarcodes: string[]
  cats: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  createdMany: CreateProductData[]
  catSeq: number
  supSeq: number
}

function fakeRepository(state: FakeState, overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    findAll: async () => ({ products: [], total: 0, page: 1, limit: 50 }),
    findById: async () => null,
    findByBarcode: async () => null,
    findByBarcodes: async (barcodes) =>
      barcodes.filter((b) => state.existingBarcodes.includes(b)).map((barcode) => ({ barcode })),
    resolveCategoryNames: async (names) => {
      const out: { name: string; id: string }[] = []
      for (const name of names) {
        let c = state.cats.find((x) => x.name === name)
        if (!c) {
          c = { id: `cat-${++state.catSeq}`, name }
          state.cats.push(c)
        }
        out.push({ name: c.name, id: c.id })
      }
      return out
    },
    resolveSupplierNames: async (names) => {
      const out: { name: string; id: string }[] = []
      for (const name of names) {
        let s = state.suppliers.find((x) => x.name === name)
        if (!s) {
          s = { id: `sup-${++state.supSeq}`, name }
          state.suppliers.push(s)
        }
        out.push({ name: s.name, id: s.id })
      }
      return out
    },
    create: async (data) => data as never,
    createMany: async (data) => {
      state.createdMany = data
      return { count: data.length }
    },
    update: async (_id, data) => data as never,
    softDelete: async () => { },
    softDeleteMany: async (ids) => ({ count: ids.length }),
    softDeleteAllByFilters: async () => ({ count: 0 }),
    updateStock: async (_id, q) => ({ stock: q } as never),
    ...overrides,
  }
}

function newState(): FakeState {
  return {
    existingBarcodes: [],
    cats: [],
    suppliers: [],
    createdMany: [],
    catSeq: 0,
    supSeq: 0,
  }
}

function row(overrides: Partial<ImportProductRowDto> = {}): ImportProductRowDto {
  return { name: "Producto", price: 100, ...overrides }
}

describe("createProductService.importMany", () => {
  it("importa filas válidas sin errores", async () => {
    const state = newState()
    const svc = createProductService(fakeRepository(state))
    const rows = [row({ name: "A", barcode: "111", price: 10, stock: 5 }), row({ name: "B", barcode: "222", price: 20 })]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 2)
    assert.deepEqual(res.errors, [])
    assert.equal(state.createdMany.length, 2)
  })

  it("omite y reporta barcode duplicado dentro del archivo", async () => {
    const state = newState()
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "A", barcode: "111", price: 10 }),
      row({ name: "B", barcode: "111", price: 20 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 1)
    assert.equal(res.errors.length, 1)
    assert.match(res.errors[0].message, /duplicado dentro/)
    assert.equal(res.errors[0].row, 2)
  })

  it("omite y reporta barcode que ya existe en la BD", async () => {
    const state = newState()
    state.existingBarcodes = ["999"]
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "A", barcode: "999", price: 10 }),
      row({ name: "B", barcode: "888", price: 20 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 1)
    assert.equal(res.errors.length, 1)
    assert.match(res.errors[0].message, /ya existe/)
  })

  it("resuelve categorías por nombre, creándolas si no existen", async () => {
    const state = newState()
    state.cats = [{ id: "cat-1", name: "Bebidas" }]
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "Coca", category_name: "Bebidas", price: 15 }),
      row({ name: "Pepsi", category_name: "Snacks", price: 16 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 2)
    assert.deepEqual(res.errors, [])
    assert.deepEqual(
      state.cats.map((c) => c.name).sort(),
      ["Bebidas", "Snacks"],
    )
    // "Snacks" se crea automáticamente (id asignado por el fake), "Bebidas" reusa el existente
    const coca = state.createdMany.find((c) => c.name === "Coca")
    assert.equal(coca?.category_id, "cat-1")
    const pepsi = state.createdMany.find((c) => c.name === "Pepsi")
    assert.ok(pepsi?.category_id, "se espera category_id resuelto")
  })

  it("resuelve proveedores por nombre, creándolos si no existen", async () => {
    const state = newState()
    state.suppliers = [{ id: "sup-1", name: "Distribuidora Uno" }]
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "A", supplier_name: "Distribuidora Uno", price: 10 }),
      row({ name: "B", supplier_name: "Proveedor Nuevo", price: 20 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 2)
    assert.deepEqual(res.errors, [])
    // "Proveedor Nuevo" se crea automáticamente, "Distribuidora Uno" reusa el existente
    assert.deepEqual(
      state.suppliers.map((s) => s.name).sort(),
      ["Distribuidora Uno", "Proveedor Nuevo"],
    )
    const a = state.createdMany.find((c) => c.name === "A")
    assert.equal(a?.supplier_id, "sup-1")
    const b = state.createdMany.find((c) => c.name === "B")
    assert.ok(b?.supplier_id, "se espera supplier_id resuelto (auto-creado)")
  })

  it("crea todas las filas sin barcode (name no es único en el modelo)", async () => {
    const state = newState()
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "Sueltito 1", price: 10 }),
      row({ name: "Sueltito 2", price: 20 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 2)
    assert.deepEqual(res.errors, [])
  })

  it("devuelve imported 0 y sin crear si todas las filas fallan", async () => {
    const state = newState()
    state.existingBarcodes = ["1", "2"]
    const svc = createProductService(fakeRepository(state))
    const rows = [
      row({ name: "A", barcode: "1", price: 10 }),
      row({ name: "B", barcode: "2", price: 20 }),
    ]

    const res = await svc.importMany(rows, "store-1")

    assert.equal(res.imported, 0)
    assert.equal(res.errors.length, 2)
    assert.equal(state.createdMany.length, 0)
  })
})

describe("ImportProductRowSchema (validación de fila)", async () => {
  const { ImportProductRowSchema } = await import("../presentation/products.dto")

  it("acepta venta suelta sin unit_quantity", () => {
    const r = ImportProductRowSchema.safeParse({ name: "Galleta", unit_type: "unidad", price: 5 })
    assert.equal(r.success, true)
  })

  it("rechaza empaque con unit_quantity < 2 (regla PACKAGING)", () => {
    const r = ImportProductRowSchema.safeParse({ name: "Caja", unit_type: "caja", unit_quantity: 1, price: 50 })
    assert.equal(r.success, false)
    if (!r.success) assert.match(r.error.issues[0].message, /Empaque inválido/)
  })

  it("acepta empaque con unit_quantity >= 2", () => {
    const r = ImportProductRowSchema.safeParse({ name: "Caja", unit_type: "caja", unit_quantity: 6, price: 50 })
    assert.equal(r.success, true)
  })

  it("rechaza fila sin price", () => {
    const r = ImportProductRowSchema.safeParse({ name: "Sin precio" })
    assert.equal(r.success, false)
  })
})
