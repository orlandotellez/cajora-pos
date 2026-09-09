import { describe, it } from "bun:test"
import assert from "node:assert/strict"
import { mapSaleToResponse } from "../../application/common/sales.mappers"
import type { RichSale, RichSaleService } from "../../application/common/sales.mappers"

function fakeDecimal(n: number) {
  return { valueOf: () => n } as any
}

function makeFullSale(overrides: Record<string, any> = {}): RichSale {
  return {
    id: "sale-1",
    subtotal: fakeDecimal(100),
    discount: fakeDecimal(10),
    total: fakeDecimal(90),
    payment_method: "tarjeta",
    amount_received: fakeDecimal(100),
    change_given: fakeDecimal(10),
    user_id: "user-1",
    user_name: "María",
    client_id: "client-1",
    client_name: "Juan",
    created_at: new Date("2026-08-20T10:30:00Z"),
    updated_at: new Date("2026-08-20T10:30:00Z"),
    items: [
      {
        id: "item-1",
        sale_id: "sale-1",
        product_id: "p1",
        product_name: "Widget",
        quantity: 2,
        unit_price: fakeDecimal(50),
        line_total: fakeDecimal(100),
        created_at: new Date("2026-08-20T10:30:00Z"),
        updated_at: new Date("2026-08-20T10:30:00Z"),
      },
    ],
    service_items: [
      {
        id: "si-1",
        sale_id: "sale-1",
        service_id: "svc-1",
        service_name: "Haircut",
        base_price: fakeDecimal(40),
        line_total: fakeDecimal(45),
        created_at: new Date("2026-08-20T10:30:00Z"),
        products: [
          {
            id: "sp-1",
            sale_service_id: "si-1",
            product_id: "p2",
            product_name: "Shampoo",
            quantity: 1,
            unit_price: fakeDecimal(5),
            line_total: fakeDecimal(5),
            affects_price: true,
            created_at: new Date("2026-08-20T10:30:00Z"),
          },
        ],
      } as RichSaleService,
    ],
    ...overrides,
  }
}

describe("mapSaleToResponse", () => {
  it("converts Decimal fields to numbers", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.equal(typeof result.subtotal, "number")
    assert.equal(typeof result.discount, "number")
    assert.equal(typeof result.total, "number")
    assert.equal(result.subtotal, 100)
    assert.equal(result.discount, 10)
    assert.equal(result.total, 90)
  })

  it("converts created_at Date to ISO string", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.equal(typeof result.created_at, "string")
    assert.equal(result.created_at, "2026-08-20T10:30:00.000Z")
  })

  it("converts amount_received and change_given from Decimal to number", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.equal(result.amount_received, 100)
    assert.equal(result.change_given, 10)
  })

  it("maps item Decimal fields to numbers", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.ok(result.items)
    assert.equal(result.items.length, 1)
    assert.equal(typeof result.items[0].unit_price, "number")
    assert.equal(typeof result.items[0].line_total, "number")
    assert.equal(result.items[0].unit_price, 50)
    assert.equal(result.items[0].line_total, 100)
    assert.equal(result.items[0].product_name, "Widget")
  })

  it("maps service_items with base_price and line_total as numbers", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.ok(result.service_items)
    assert.equal(result.service_items.length, 1)
    assert.equal(typeof result.service_items[0].base_price, "number")
    assert.equal(typeof result.service_items[0].line_total, "number")
    assert.equal(result.service_items[0].base_price, 40)
    assert.equal(result.service_items[0].line_total, 45)
    assert.equal(result.service_items[0].service_name, "Haircut")
  })

  it("maps service_products with affects_price defaulting to false when null", () => {
    const sale = makeFullSale()
    sale.service_items![0].products![0].affects_price = null as any
    const result = mapSaleToResponse(sale)

    assert.ok(result.service_items)
    assert.ok(result.service_items[0].products)
    assert.equal(result.service_items[0].products[0].affects_price, false)
  })

  it("preserves affects_price true", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.equal(result.service_items![0].products![0].affects_price, true)
  })

  it("returns undefined for amount_received and change_given when not present", () => {
    const sale = makeFullSale({ amount_received: undefined, change_given: undefined })
    const result = mapSaleToResponse(sale)

    assert.equal(result.amount_received, undefined)
    assert.equal(result.change_given, undefined)
  })

  it("returns undefined for client_id when null", () => {
    const sale = makeFullSale({ client_id: null })
    const result = mapSaleToResponse(sale)

    assert.equal(result.client_id, undefined)
  })

  it("returns empty array for service_products when products is undefined", () => {
    const sale = makeFullSale()
    delete (sale.service_items![0] as any).products
    const result = mapSaleToResponse(sale)

    assert.ok(result.service_items)
    assert.deepEqual(result.service_items[0].products, [])
  })

  it("returns undefined items and service_items when not present on sale", () => {
    const sale = makeFullSale({ items: undefined, service_items: undefined })
    const result = mapSaleToResponse(sale)

    assert.equal(result.items, undefined)
    assert.equal(result.service_items, undefined)
  })

  it("handles created_at as a string (non-Date)", () => {
    const sale = makeFullSale({ created_at: "2026-08-20T10:30:00.000Z" as any })
    const result = mapSaleToResponse(sale)

    assert.equal(result.created_at, "2026-08-20T10:30:00.000Z")
  })

  it("maps all basic fields correctly", () => {
    const sale = makeFullSale()
    const result = mapSaleToResponse(sale)

    assert.equal(result.id, "sale-1")
    assert.equal(result.payment_method, "tarjeta")
    assert.equal(result.user_id, "user-1")
    assert.equal(result.user_name, "María")
    assert.equal(result.client_name, "Juan")
  })
})
