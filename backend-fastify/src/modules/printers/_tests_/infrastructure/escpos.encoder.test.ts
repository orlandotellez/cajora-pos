import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  selectProfileEncoders,
  resolveCurrencySymbol,
  renderTestTicket,
  renderCodepageProbe,
  duplicateForCopies,
  renderSaleReceipt,
  CMD,
  type SaleReceiptData,
  type SaleReceiptConfig,
} from "../../infrastructure/escpos/encoder"

function decodeLatin1(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) out += String.fromCharCode(b)
  return out
}

function containsSequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

function makeSaleData(overrides: Partial<SaleReceiptData> = {}): SaleReceiptData {
  return {
    store_name: "Tienda Central",
    store_address: "Av. Principal 123",
    store_phone: "555-1234",
    ticket_footer: null,
    sale_id: "abc12345def67890",
    user_name: "Juan",
    client_name: null,
    created_at: new Date("2026-09-01T10:00:00Z"),
    subtotal: 1100,
    discount: 100,
    total: 1000,
    payment_method: "efectivo",
    amount_received: 1000,
    change_given: 0,
    currency_symbol: "C$",
    items: [
      { product_name: "Coca Cola 500ml", quantity: 2, unit_price: 50, line_total: 100 },
      { product_name: "Papas Fritas", quantity: 1, unit_price: 45, line_total: 45 },
    ],
    service_items: [],
    ...overrides,
  }
}

function makeSaleConfig(overrides: Partial<SaleReceiptConfig> = {}): SaleReceiptConfig {
  return {
    paper_width: 80,
    profile: "escpos",
    codepage: "CP850",
    open_cash_drawer: false,
    cut_type: "full",
    ...overrides,
  }
}

describe("escpos encoder", () => {
  describe("selectProfileEncoders", () => {
    it("resuelve profile y codepage por defecto", () => {
      const sel = selectProfileEncoders()
      assert.equal(sel.resolvedProfile, "escpos")
      assert.equal(sel.resolvedCodepage, "CP850")
      assert.equal(sel.codepageCommand!.length, 3)
      assert.equal(sel.codepageCommand![0], 0x1b)
      assert.equal(sel.codepageCommand![1], 0x74)
      assert.equal(sel.codepageCommand![2], 2)
    })

    it("cae a defaults cuando el profile no existe", () => {
      const sel = selectProfileEncoders("unknown", "CP850")
      assert.equal(sel.resolvedProfile, "escpos")
    })

    it("cae a CP850 cuando la codepage no existe", () => {
      const sel = selectProfileEncoders("star_line", "LATIN_999")
      assert.equal(sel.resolvedCodepage, "CP850")
    })

    it("lowercase profile y uppercase codepage normalizan inputs", () => {
      const sel = selectProfileEncoders("STAR_LINE", "cp1252")
      assert.equal(sel.resolvedProfile, "star_line")
      assert.equal(sel.resolvedCodepage, "CP1252")
    })

    it("codepageCommand es null cuando la combinacion no existe en el profile", () => {
      const sel = selectProfileEncoders("star_line", "ISO-8859-1")
      assert.equal(sel.codepageCommand, null)
    })

    it("encode mapea caracteres no ASCII segun la codepage", () => {
      const sel = selectProfileEncoders("escpos", "CP1252")
      const out = sel.encode("ñáé€")
      assert.deepEqual(Array.from(out), [0xf1, 0xe1, 0xe9, 0x80])
    })

    it("encode mapea caracteres no soportados a '?'", () => {
      const sel = selectProfileEncoders("escpos", "CP850")
      const out = sel.encode("Ω")
      assert.equal(out[0], 0x3f)
    })
  })

  describe("resolveCurrencySymbol", () => {
    it("devuelve C$ para NIO", () => {
      assert.equal(resolveCurrencySymbol("NIO"), "C$")
    })

    it("devuelve $ para USD", () => {
      assert.equal(resolveCurrencySymbol("USD"), "$")
    })

    it("devuelve el simbolo del euro para EUR", () => {
      assert.equal(resolveCurrencySymbol("EUR"), "€")
    })

    it("devuelve $ para MXN", () => {
      assert.equal(resolveCurrencySymbol("MXN"), "$")
    })

    it("devuelve $ para moneda desconocida", () => {
      assert.equal(resolveCurrencySymbol("BTC"), "$")
    })
  })

  describe("renderSaleReceipt", () => {
    it("incluye header del store, ticket y usuario en 80mm", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData())
      const text = decodeLatin1(bytes)
      assert.match(text, /Tienda Central/)
      assert.match(text, /Av\. Principal 123/)
      assert.match(text, /555-1234/)
      assert.match(text, /abc12345/)
      assert.match(text, /Juan/)
      assert.match(text, /Cliente General/)
      assert.match(text, /efectivo/)
    })

    it("incluye lineas de items con cantidad y precios", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData())
      const text = decodeLatin1(bytes)
      assert.match(text, /Coca Cola 500ml/)
      assert.match(text, /2/)
      assert.match(text, /100\.00/)
      assert.match(text, /Papas Fritas/)
      assert.match(text, /45\.00/)
    })

    it("incluye servicios con incluidos y aditivos", () => {
      const data = makeSaleData({
        service_items: [
          {
            service_name: "Lavado de Auto",
            base_price: 150,
            line_total: 165,
            products: [
              { product_name: "Agua", quantity: 1, unit_price: 10, line_total: 10, affects_price: false },
              { product_name: "Sonrisa", quantity: 3, unit_price: 5, line_total: 15, affects_price: true },
            ],
          },
        ],
      })
      const bytes = renderSaleReceipt(makeSaleConfig(), data)
      const text = decodeLatin1(bytes)
      assert.match(text, /Lavado de Auto/)
      assert.match(text, /Incluye: Agua x1/)
      assert.match(text, /Sonrisa x3/)
      assert.match(text, /Total servicio/)
      assert.match(text, /165\.00/)
    })

    it("incluye subtotal, descuento y total", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData())
      const text = decodeLatin1(bytes)
      assert.match(text, /Subtotal/)
      assert.match(text, /1100\.00/)
      assert.match(text, /Descuento/)
      assert.match(text, /-.*100\.00/)
      assert.match(text, /TOTAL/)
      assert.match(text, /1000\.00/)
    })

    it("no muestra linea de cambio cuando change_given es 0 o null", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData({ change_given: 0 }))
      const text = decodeLatin1(bytes)
      assert.doesNotMatch(text, /Cambio/)
    })

    it("muestra linea de cambio cuando change_given es positivo", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData({ change_given: 150 }))
      const text = decodeLatin1(bytes)
      assert.match(text, /Cambio/)
      assert.match(text, /150\.00/)
    })

    it("usa currency_symbol en los precios", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData({ currency_symbol: "C$" }))
      const text = decodeLatin1(bytes)
      assert.match(text, /C\$/)
    })

    it("usa el footer por defecto cuando ticket_footer es null", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData())
      const text = decodeLatin1(bytes)
      assert.match(text, /Gracias por su compra/)
    })

    it("usa ticket_footer custom cuando esta presente", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData({ ticket_footer: "Vuelva pronto!" }))
      const text = decodeLatin1(bytes)
      assert.match(text, /Vuelva pronto!/)
    })

    it("incluye CUT_FULL cuando cut_type es full", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ cut_type: "full" }), makeSaleData())
      assert.ok(containsSequence(bytes, CMD.CUT_FULL), "CUT_FULL presente")
    })

    it("incluye CUT_PARTIAL cuando cut_type es partial", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ cut_type: "partial" }), makeSaleData())
      assert.ok(containsSequence(bytes, CMD.CUT_PARTIAL), "CUT_PARTIAL presente")
    })

    it("no incluye corte cuando cut_type es null", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ cut_type: null }), makeSaleData())
      assert.ok(!containsSequence(bytes, CMD.CUT_FULL), "CUT_FULL ausente")
      assert.ok(!containsSequence(bytes, CMD.CUT_PARTIAL), "CUT_PARTIAL ausente")
    })

    it("incluye OPEN_DRAWER cuando open_cash_drawer es true", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ open_cash_drawer: true }), makeSaleData())
      assert.ok(containsSequence(bytes, CMD.OPEN_DRAWER), "OPEN_DRAWER presente")
    })

    it("no incluye OPEN_DRAWER cuando open_cash_drawer es false", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ open_cash_drawer: false }), makeSaleData())
      assert.ok(!containsSequence(bytes, CMD.OPEN_DRAWER), "OPEN_DRAWER ausente")
    })

    it("usa layout 2 columnas en papel de 58mm", () => {
      const bytes = renderSaleReceipt(makeSaleConfig({ paper_width: 58 }), makeSaleData())
      const text = decodeLatin1(bytes)
      assert.match(text, /2x Coca Cola 500ml/)
    })

    it("empieza con INIT y codepage command", () => {
      const bytes = renderSaleReceipt(makeSaleConfig(), makeSaleData())
      assert.equal(bytes[0], 0x1b)
      assert.equal(bytes[1], 0x40)
    })
  })

  describe("duplicateForCopies", () => {
    it("devuelve la misma referencia cuando copies es 1", () => {
      const input = new Uint8Array([1, 2, 3])
      const out = duplicateForCopies(input, 1)
      assert.equal(out, input)
    })

    it("devuelve la misma referencia cuando copies es 0", () => {
      const input = new Uint8Array([1, 2, 3])
      const out = duplicateForCopies(input, 0)
      assert.equal(out, input)
    })

    it("duplica el contenido al doble para copies 2", () => {
      const input = new Uint8Array([1, 2, 3])
      const out = duplicateForCopies(input, 2)
      assert.equal(out.length, 6)
      assert.deepEqual(Array.from(out), [1, 2, 3, 1, 2, 3])
    })

    it("duplica el contenido por N para copies N", () => {
      const input = new Uint8Array([9, 8])
      const out = duplicateForCopies(input, 4)
      assert.equal(out.length, 8)
      assert.deepEqual(Array.from(out), [9, 8, 9, 8, 9, 8, 9, 8])
    })
  })

  describe("renderTestTicket", () => {
    it("incluye contenido de prueba para 80mm", () => {
      const bytes = renderTestTicket({ paper_width: 80, profile: "escpos", codepage: "CP850", open_cash_drawer: false, cut_type: "full", copies: 1 })
      const text = decodeLatin1(bytes)
      assert.match(text, /TICKET DE PRUEBA/)
      assert.match(text, /Impresi.n en negrita/)
      assert.match(text, /Ancho de papel: 80mm/)
      assert.match(text, /Copias enviadas: 1/)
    })

    it("incluye content del store_name cuando existe", () => {
      const bytes = renderTestTicket({ paper_width: 58, profile: "escpos", codepage: "CP850", open_cash_drawer: false, cut_type: null, copies: 3, store_name: "Mi Tienda" })
      const text = decodeLatin1(bytes)
      assert.match(text, /Mi Tienda/)
    })

    it("incluye OPEN_DRAWER cuando open_cash_drawer es true", () => {
      const bytes = renderTestTicket({ paper_width: 58, profile: "escpos", codepage: "CP850", open_cash_drawer: true, cut_type: null, copies: 1 })
      assert.ok(containsSequence(bytes, CMD.OPEN_DRAWER))
    })

    it("incluye CUT_FULL cuando cut_type es full", () => {
      const bytes = renderTestTicket({ paper_width: 58, profile: "escpos", codepage: "CP850", open_cash_drawer: false, cut_type: "full", copies: 1 })
      assert.ok(containsSequence(bytes, CMD.CUT_FULL))
    })
  })

  describe("renderCodepageProbe", () => {
    it("incluye header del probe", () => {
      const bytes = renderCodepageProbe()
      const text = decodeLatin1(bytes)
      assert.match(text, /CODEPAGE PROBE/)
    })

    it("prueba indices del 0 al 40", () => {
      const bytes = renderCodepageProbe()
      const text = decodeLatin1(bytes)
      assert.match(text, /CP  0:/)
      assert.match(text, /CP 40:/)
    })

    it("termina con CUT_PARTIAL", () => {
      const bytes = renderCodepageProbe()
      const tail = bytes.slice(bytes.length - CMD.CUT_PARTIAL.length)
      assert.deepEqual(tail, CMD.CUT_PARTIAL)
    })
  })
})