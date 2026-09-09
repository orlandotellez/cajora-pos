import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapRecordToEntity, mapEntityToResponse, PRINTER_SELECT } from "../../application/common/printers.mappers"
import type { IPrinterEntity } from "../../domain/printers.entities"

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "printer-1",
    store_id: "store-1",
    name: "Impresora Cocina",
    connection_type: "net",
    address: "192.168.1.10",
    port: 9100,
    paper_width: 80,
    profile: "escpos",
    codepage: "CP850",
    auto_cut: true,
    cut_type: "full",
    open_cash_drawer: false,
    default_copies: 1,
    role: "kitchen",
    is_default: false,
    is_active: true,
    last_status: "unknown",
    last_seen_at: new Date("2026-09-01T10:00:00Z"),
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

function makeEntity(overrides: Partial<IPrinterEntity> = {}): IPrinterEntity {
  return {
    id: "printer-1",
    store_id: "store-1",
    name: "Impresora Cocina",
    connection_type: "net",
    address: "192.168.1.10",
    port: 9100,
    paper_width: 80,
    profile: "escpos",
    codepage: "CP850",
    auto_cut: true,
    cut_type: "full",
    open_cash_drawer: false,
    default_copies: 1,
    role: "kitchen",
    is_default: false,
    is_active: true,
    last_status: "unknown",
    last_seen_at: new Date("2026-09-01T10:00:00Z"),
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

describe("printers mappers", () => {
  describe("mapRecordToEntity", () => {
    it("mapea todos los campos correctamente", () => {
      const entity = mapRecordToEntity(makeRow() as any)
      assert.equal(entity.id, "printer-1")
      assert.equal(entity.store_id, "store-1")
      assert.equal(entity.name, "Impresora Cocina")
      assert.equal(entity.address, "192.168.1.10")
      assert.equal(entity.port, 9100)
      assert.equal(entity.paper_width, 80)
      assert.equal(entity.codepage, "CP850")
      assert.equal(entity.auto_cut, true)
      assert.equal(entity.open_cash_drawer, false)
      assert.equal(entity.default_copies, 1)
      assert.equal(entity.is_default, false)
      assert.equal(entity.is_active, true)
    })

    it("casta connection_type como PrinterConnType", () => {
      const entity = mapRecordToEntity(makeRow() as any)
      assert.equal(entity.connection_type, "net")
      assert.ok(typeof entity.connection_type === "string")
    })

    it("casta profile como PrinterProfile", () => {
      const entity = mapRecordToEntity(makeRow() as any)
      assert.equal(entity.profile, "escpos")
    })

    it("casta role como PrinterRole", () => {
      const entity = mapRecordToEntity(makeRow({ role: "receipt" }) as any)
      assert.equal(entity.role, "receipt")
    })

    it("casta last_status como PrinterActualStatus", () => {
      const entity = mapRecordToEntity(makeRow({ last_status: "idle" }) as any)
      assert.equal(entity.last_status, "idle")
    })

    it("preserva cut_type cuando es un string", () => {
      const entity = mapRecordToEntity(makeRow({ cut_type: "partial" }) as any)
      assert.equal(entity.cut_type, "partial")
    })

    it("preserva cut_type cuando es null", () => {
      const entity = mapRecordToEntity(makeRow({ cut_type: null }) as any)
      assert.equal(entity.cut_type, null)
    })

    it("preserva last_seen_at como Date cuando no es null", () => {
      const d = new Date("2026-09-01T10:00:00Z")
      const entity = mapRecordToEntity(makeRow({ last_seen_at: d }) as any)
      assert.ok(entity.last_seen_at instanceof Date)
      assert.equal(entity.last_seen_at!.toISOString(), d.toISOString())
    })

    it("preserva last_seen_at como null", () => {
      const entity = mapRecordToEntity(makeRow({ last_seen_at: null }) as any)
      assert.equal(entity.last_seen_at, null)
    })

    it("preserva created_at y updated_at como Date", () => {
      const created = new Date("2026-08-01T09:00:00Z")
      const updated = new Date("2026-08-30T15:30:00Z")
      const entity = mapRecordToEntity(makeRow({ created_at: created, updated_at: updated }) as any)
      assert.ok(entity.created_at instanceof Date)
      assert.ok(entity.updated_at instanceof Date)
      assert.equal(entity.created_at.toISOString(), created.toISOString())
      assert.equal(entity.updated_at.toISOString(), updated.toISOString())
    })
  })

  describe("mapEntityToResponse", () => {
    it("mapea todos los campos passthrough", () => {
      const response = mapEntityToResponse(makeEntity())
      assert.equal(response.id, "printer-1")
      assert.equal(response.store_id, "store-1")
      assert.equal(response.name, "Impresora Cocina")
      assert.equal(response.connection_type, "net")
      assert.equal(response.address, "192.168.1.10")
      assert.equal(response.port, 9100)
      assert.equal(response.paper_width, 80)
      assert.equal(response.profile, "escpos")
      assert.equal(response.codepage, "CP850")
      assert.equal(response.auto_cut, true)
      assert.equal(response.cut_type, "full")
      assert.equal(response.open_cash_drawer, false)
      assert.equal(response.default_copies, 1)
      assert.equal(response.role, "kitchen")
      assert.equal(response.is_default, false)
      assert.equal(response.is_active, true)
      assert.equal(response.last_status, "unknown")
    })

    it("convierte last_seen_at Date a ISO string", () => {
      const d = new Date("2026-09-01T10:00:00Z")
      const response = mapEntityToResponse(makeEntity({ last_seen_at: d }))
      assert.equal(typeof response.last_seen_at, "string")
      assert.equal(response.last_seen_at, "2026-09-01T10:00:00.000Z")
    })

    it("deja last_seen_at como null cuando es null", () => {
      const response = mapEntityToResponse(makeEntity({ last_seen_at: null }))
      assert.equal(response.last_seen_at, null)
    })

    it("convierte created_at Date a ISO string", () => {
      const d = new Date("2026-08-01T09:00:00Z")
      const response = mapEntityToResponse(makeEntity({ created_at: d }))
      assert.equal(typeof response.created_at, "string")
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
    })

    it("convierte updated_at Date a ISO string", () => {
      const d = new Date("2026-08-30T15:30:00Z")
      const response = mapEntityToResponse(makeEntity({ updated_at: d }))
      assert.equal(typeof response.updated_at, "string")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("pasa strings ya formateadas tal cual", () => {
      const response = mapEntityToResponse(makeEntity({
        last_seen_at: "2026-09-01T10:00:00.000Z" as unknown as Date,
        created_at: "2026-08-01T09:00:00.000Z" as unknown as Date,
        updated_at: "2026-08-30T15:30:00.000Z" as unknown as Date,
      }))
      assert.equal(response.last_seen_at, "2026-09-01T10:00:00.000Z")
      assert.equal(response.created_at, "2026-08-01T09:00:00.000Z")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("preserva cut_type como null", () => {
      const response = mapEntityToResponse(makeEntity({ cut_type: null }))
      assert.equal(response.cut_type, null)
    })
  })

  describe("PRINTER_SELECT", () => {
    it("contiene todos los campos esperados", () => {
      assert.equal(PRINTER_SELECT.id, true)
      assert.equal(PRINTER_SELECT.store_id, true)
      assert.equal(PRINTER_SELECT.name, true)
      assert.equal(PRINTER_SELECT.connection_type, true)
      assert.equal(PRINTER_SELECT.cut_type, true)
      assert.equal(PRINTER_SELECT.last_seen_at, true)
      assert.equal(PRINTER_SELECT.created_at, true)
      assert.equal(PRINTER_SELECT.updated_at, true)
    })
  })
})
