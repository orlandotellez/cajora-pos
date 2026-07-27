const CHAR_MAPS: Record<string, Record<string, number>> = {
  CP850: {
    "á": 0xA0, "é": 0x82, "í": 0xA1, "ó": 0xA2, "ú": 0xA3,
    "Á": 0xB5, "É": 0x90, "Í": 0xD6, "Ó": 0xE0, "Ú": 0xE9,
    "ñ": 0xA4, "Ñ": 0xA5,
    "¿": 0xA8, "¡": 0xAD,
  },
  CP858: {
    "á": 0xA0, "é": 0x82, "í": 0xA1, "ó": 0xA2, "ú": 0xA3,
    "Á": 0xB5, "É": 0x90, "Í": 0xD6, "Ó": 0xE0, "Ú": 0xE9,
    "ñ": 0xA4, "Ñ": 0xA5,
    "¿": 0xA8, "¡": 0xAD,
    "€": 0xD5,
  },
  CP1252: {
    "á": 0xE1, "é": 0xE9, "í": 0xED, "ó": 0xF3, "ú": 0xFA,
    "Á": 0xC1, "É": 0xC9, "Í": 0xCD, "Ó": 0xD3, "Ú": 0xDA,
    "ñ": 0xF1, "Ñ": 0xD1,
    "¿": 0xBF, "¡": 0xA1,
    "€": 0x80,
  },
  "ISO-8859-1": {
    "á": 0xE1, "é": 0xE9, "í": 0xED, "ó": 0xF3, "ú": 0xFA,
    "Á": 0xC1, "É": 0xC9, "Í": 0xCD, "Ó": 0xD3, "Ú": 0xDA,
    "ñ": 0xF1, "Ñ": 0xD1,
    "¿": 0xBF, "¡": 0xA1,
  },
}

const VENDOR_PROFILES: Record<string, Record<string, number>> = {
  escpos: { CP437: 0, CP850: 2, CP1252: 16, CP858: 19, "ISO-8859-1": 16 },
  star_line: { CP437: 0, CP850: 2, CP1252: 32, CP858: 33 },
}

const ESC = 0x1B
const GS = 0x1D

export const CMD = {
  INIT: new Uint8Array([ESC, 0x40]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  CUT_FULL: new Uint8Array([GS, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([GS, 0x56, 0x01]),
  OPEN_DRAWER: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]),
  LF: new Uint8Array([0x0A]),
}

export interface SelectedEncoders {
  encode: (text: string) => Uint8Array
  codepageCommand: Uint8Array | null
  resolvedProfile: string
  resolvedCodepage: string
}

export function selectProfileEncoders(
  profileName: string = "escpos",
  codepageName: string = "CP850"
): SelectedEncoders {
  const safeProfile = VENDOR_PROFILES[profileName.toLowerCase()] ? profileName.toLowerCase() : "escpos"
  const safeCodepage = CHAR_MAPS[codepageName.toUpperCase()] ? codepageName.toUpperCase() : "CP850"

  const charMap = CHAR_MAPS[safeCodepage]
  const index = VENDOR_PROFILES[safeProfile][safeCodepage]

  const codepageCommand =
    index !== undefined
      ? new Uint8Array([ESC, 0x74, index])
      : null

  const encode = (text: string): Uint8Array => {
    const out = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const code = ch.charCodeAt(0)
      if (code < 128) {
        out[i] = code
      } else {
        out[i] = charMap[ch] ?? 0x3F
      }
    }
    return out
  }

  return { encode, codepageCommand, resolvedProfile: safeProfile, resolvedCodepage: safeCodepage }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NIO: "C$",
  USD: "$",
  EUR: "€",
  MXN: "$",
}

export function resolveCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? "$"
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

export interface TestTicketConfig {
  paper_width: 58 | 80
  profile: string
  codepage: string
  open_cash_drawer: boolean
  cut_type: "full" | "partial" | null
  copies: number
  store_name?: string
}

export function renderTestTicket(config: TestTicketConfig): Uint8Array {
  const encoders = selectProfileEncoders(config.profile, config.codepage)
  const enc = encoders.encode

  const chars = config.paper_width === 80 ? 42 : 32
  const sep = "=".repeat(chars)
  const center = (s: string) => {
    const pad = Math.max(0, Math.floor((chars - s.length) / 2))
    return " ".repeat(pad) + s
  }

  const parts: Uint8Array[] = []

  parts.push(CMD.INIT)
  if (encoders.codepageCommand) {
    parts.push(encoders.codepageCommand)
  }

  parts.push(CMD.ALIGN_CENTER)
  parts.push(CMD.BOLD_ON)
  parts.push(enc(center("*** TICKET DE PRUEBA ***") + "\n"))
  parts.push(CMD.BOLD_OFF)
  parts.push(enc("Impresoras POS - prueba\n"))
  if (config.store_name) {
    parts.push(enc(config.store_name + "\n"))
  }
  parts.push(enc(new Date().toLocaleString("es-AR") + "\n"))
  parts.push(enc(encoders.resolvedProfile + ":" + encoders.resolvedCodepage + "\n"))
  parts.push(enc(sep + "\n"))

  parts.push(CMD.ALIGN_LEFT)
  parts.push(CMD.BOLD_ON)
  parts.push(enc("Impresión en negrita\n"))
  parts.push(CMD.BOLD_OFF)
  parts.push(enc("Texto normal\n"))
  parts.push(enc("Caracteres acentuados: ñ á é í ó ú\n"))
  parts.push(enc("Mayúsculas: Ñ Á É Í Ó Ú\n"))
  parts.push(enc("Signos: ¿ ¡\n"))

  parts.push(enc("\n" + sep + "\n"))

  parts.push(CMD.ALIGN_CENTER)
  parts.push(CMD.BOLD_ON)
  parts.push(enc("-- Texto centrado + negrita --\n"))
  parts.push(CMD.BOLD_OFF)
  parts.push(enc("-- Texto centrado normal --\n"))

  parts.push(CMD.ALIGN_LEFT)
  parts.push(enc("\n" + sep + "\n"))
  parts.push(enc("Ancho de papel: " + config.paper_width + "mm\n"))
  parts.push(enc("Vendor profile: " + encoders.resolvedProfile + "\n"))
  parts.push(enc("Codepage activo: " + encoders.resolvedCodepage + "\n"))
  parts.push(enc("Copias enviadas: " + config.copies + "\n"))

  parts.push(CMD.LF)
  parts.push(CMD.LF)
  parts.push(CMD.LF)

  if (config.open_cash_drawer) {
    parts.push(CMD.OPEN_DRAWER)
  }

  if (config.cut_type === "full") {
    parts.push(CMD.CUT_FULL)
  } else if (config.cut_type === "partial") {
    parts.push(CMD.CUT_PARTIAL)
  }

  return concat(...parts)
}

export function renderCodepageProbe(): Uint8Array {
  const parts: Uint8Array[] = []

  const encodeAscii = (s: string): Uint8Array => {
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      out[i] = c < 128 ? c : 0x3F
    }
    return out
  }

  parts.push(CMD.INIT)
  parts.push(CMD.ALIGN_LEFT)
  parts.push(CMD.BOLD_ON)
  parts.push(encodeAscii("CODEPAGE PROBE (idx 0..40)\n\n"))
  parts.push(CMD.BOLD_OFF)
  parts.push(encodeAscii("Para cada idx N imprime: ESC t N + muestra ñ á é í ó ú\n"))
  parts.push(encodeAscii("Donde veas todos correctos, ese es tu CP850 index.\n\n"))

  const SAMPLE_BYTES = new Uint8Array([0xF1, 0x20, 0xE1, 0x20, 0xE9, 0x20, 0xED, 0x20, 0xF3, 0x20, 0xFA, 0x0A])

  for (let i = 0; i <= 40; i++) {
    parts.push(CMD.INIT)
    parts.push(new Uint8Array([ESC, 0x74, i]))
    parts.push(encodeAscii(`CP ${i.toString().padStart(2, " ")}: `))
    parts.push(SAMPLE_BYTES)
  }

  parts.push(new Uint8Array([ESC, 0x74, 0x00]))
  parts.push(CMD.LF)
  parts.push(CMD.CUT_PARTIAL)

  return concat(...parts)
}

export function duplicateForCopies(bytes: Uint8Array, copies: number): Uint8Array {
  if (copies <= 1) return bytes
  const result = new Uint8Array(bytes.length * copies)
  for (let i = 0; i < copies; i++) {
    result.set(bytes, i * bytes.length)
  }
  return result
}

export interface SaleReceiptConfig {
  paper_width: 58 | 80
  profile: string
  codepage: string
  open_cash_drawer: boolean
  cut_type: "full" | "partial" | null
}

export interface SaleReceiptItem {
  product_name: string
  quantity: number
  line_total: number
}

export interface SaleReceiptServiceProduct {
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  affects_price: boolean
}

export interface SaleReceiptService {
  service_name: string
  base_price: number
  line_total: number
  products: SaleReceiptServiceProduct[]
}

export interface SaleReceiptData {
  store_name: string
  store_address: string | null
  store_phone: string | null
  ticket_footer: string | null
  sale_id: string
  user_name: string
  created_at: Date
  subtotal: number
  discount: number
  total: number
  payment_method: string
  amount_received: number | null
  change_given: number | null
  currency_symbol: string
  items: SaleReceiptItem[]
  service_items: SaleReceiptService[]
}

export function renderSaleReceipt(config: SaleReceiptConfig, data: SaleReceiptData): Uint8Array {
  const encoders = selectProfileEncoders(config.profile, config.codepage)
  const enc = encoders.encode
  const chars = config.paper_width === 80 ? 42 : 32
  const sep = "=".repeat(chars)
  const dash = "-".repeat(chars)

  const sym = data.currency_symbol || "$"
  const fmt2 = (n: number): string => sym + n.toFixed(2)
  const priceRight = (label: string, price: string, max: number): string => {
    const space = Math.max(1, max - label.length - price.length)
    return label + " ".repeat(space) + price
  }

  const parts: Uint8Array[] = []

  parts.push(CMD.INIT)
  if (encoders.codepageCommand) parts.push(encoders.codepageCommand)

  // Store header
  parts.push(CMD.ALIGN_CENTER)
  parts.push(CMD.BOLD_ON)
  parts.push(enc(data.store_name + "\n"))
  parts.push(CMD.BOLD_OFF)
  if (data.store_address) parts.push(enc(data.store_address + "\n"))
  if (data.store_phone) parts.push(enc(data.store_phone + "\n"))

  const dateStr = data.created_at.toLocaleString("es-AR")
  parts.push(enc(dateStr + "\n"))
  parts.push(enc("Ticket: " + data.sale_id.slice(0, 8) + "\n"))
  parts.push(enc("Atendido por: " + data.user_name + "\n"))

  // Separator
  // Thin separator (dashes like the frontend)
  parts.push(CMD.ALIGN_LEFT)
  parts.push(enc(dash + "\n"))

  // Regular items
  for (const item of data.items) {
    const line = `${item.quantity}× ${item.product_name}`
    const price = fmt2(item.line_total)
    const maxNameLen = chars - price.length - 2
    const truncated = line.length > maxNameLen ? line.slice(0, maxNameLen) + ".." : line
    parts.push(enc(truncated + " ".repeat(Math.max(1, chars - truncated.length - price.length)) + price + "\n"))
  }

  // Service items
  if (data.service_items && data.service_items.length > 0) {
    for (const svc of data.service_items) {
      parts.push(enc(svc.service_name + "\n"))

      const included = svc.products.filter((p) => !p.affects_price && p.quantity > 0)
      const additives = svc.products.filter((p) => p.affects_price && p.quantity > 0)

      if (included.length > 0) {
        const names = included.map((p) => `${p.product_name} ×${p.quantity}`).join(", ")
        parts.push(enc("  Incluye: " + names + "\n"))
      }

      for (const p of additives) {
        const addLine = "  + " + p.product_name + " ×" + p.quantity
        const price = fmt2(p.line_total)
        parts.push(enc(priceRight(addLine, price, chars) + "\n"))
      }

      if (additives.length > 0) {
        parts.push(enc(priceRight("  Total servicio", fmt2(svc.line_total), chars) + "\n"))
      }

      parts.push(enc(dash + "\n"))
    }
  }

  // Thin separator
  parts.push(CMD.ALIGN_LEFT)
  parts.push(enc(dash + "\n"))

  // Totals
  parts.push(enc(priceRight("Subtotal", fmt2(data.subtotal), chars) + "\n"))

  if (data.discount > 0) {
    parts.push(enc(priceRight("Descuento", "-" + fmt2(data.discount), chars) + "\n"))
  } else {
    parts.push(enc(priceRight("Descuento", fmt2(data.discount), chars) + "\n"))
  }

  // Thick separator before TOTAL (like the frontend's double border)
  parts.push(CMD.BOLD_ON)
  parts.push(enc(sep + "\n"))
  parts.push(CMD.BOLD_OFF)
  parts.push(CMD.BOLD_ON)
  parts.push(enc(priceRight("TOTAL", fmt2(data.total), chars) + "\n"))
  parts.push(CMD.BOLD_OFF)

  const payLine = `Pago (${data.payment_method})`
  const received = data.amount_received ?? data.total
  parts.push(enc(priceRight(payLine, fmt2(Number(received)), chars) + "\n"))
  if (data.change_given && data.change_given > 0) {
    parts.push(enc(priceRight("Cambio", fmt2(data.change_given), chars) + "\n"))
  }

  // Thin separator before footer (like the frontend)
  parts.push(CMD.ALIGN_LEFT)
  parts.push(enc(dash + "\n"))

  // Footer
  parts.push(CMD.ALIGN_CENTER)
  parts.push(enc((data.ticket_footer || "¡Gracias por su compra!") + "\n"))

  parts.push(CMD.LF)
  parts.push(CMD.LF)

  if (config.open_cash_drawer) parts.push(CMD.OPEN_DRAWER)
  if (config.cut_type === "full") parts.push(CMD.CUT_FULL)
  else if (config.cut_type === "partial") parts.push(CMD.CUT_PARTIAL)

  return concat(...parts)
}
