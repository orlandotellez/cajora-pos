import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapSettingsToResponse } from "../../application/common/settings.mappers"
import type { ISettingsEntity } from "../../domain/settings.entities"

function makeSettings(overrides: Record<string, unknown> = {}): ISettingsEntity {
  return {
    id: 1,
    name: "Mi Negocio",
    address: "Av. Principal 789",
    phone: "+5491188884444",
    low_stock_threshold: 10,
    ticket_footer: "Gracias por su compra",
    cash_register_enabled: true,
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  } as ISettingsEntity
}

describe("settings mappers", () => {
  describe("mapSettingsToResponse", () => {
    it("maps all fields correctly", () => {
      const response = mapSettingsToResponse(makeSettings())
      assert.equal(response.name, "Mi Negocio")
      assert.equal(response.address, "Av. Principal 789")
      assert.equal(response.phone, "+5491188884444")
      assert.equal(response.low_stock_threshold, 10)
      assert.equal(response.ticket_footer, "Gracias por su compra")
      assert.equal(response.cash_register_enabled, true)
    })

    it("converts updated_at Date to ISO string", () => {
      const response = mapSettingsToResponse(makeSettings())
      assert.equal(typeof response.updated_at, "string")
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("passes string updated_at through as-is", () => {
      const response = mapSettingsToResponse(makeSettings({
        updated_at: "2026-08-30T15:30:00.000Z",
      }))
      assert.equal(response.updated_at, "2026-08-30T15:30:00.000Z")
    })

    it("converts address null to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ address: null }))
      assert.equal(response.address, undefined)
    })

    it("converts address empty string to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ address: "" }))
      assert.equal(response.address, undefined)
    })

    it("converts phone null to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ phone: null }))
      assert.equal(response.phone, undefined)
    })

    it("converts phone empty string to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ phone: "" }))
      assert.equal(response.phone, undefined)
    })

    it("converts ticket_footer null to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ ticket_footer: null }))
      assert.equal(response.ticket_footer, undefined)
    })

    it("converts ticket_footer empty string to undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ ticket_footer: "" }))
      assert.equal(response.ticket_footer, undefined)
    })

    it("returns address undefined when undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ address: undefined }))
      assert.equal(response.address, undefined)
    })

    it("returns phone undefined when undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ phone: undefined }))
      assert.equal(response.phone, undefined)
    })

    it("returns ticket_footer undefined when undefined", () => {
      const response = mapSettingsToResponse(makeSettings({ ticket_footer: undefined }))
      assert.equal(response.ticket_footer, undefined)
    })

    it("passes low_stock_threshold as-is", () => {
      const response = mapSettingsToResponse(makeSettings({ low_stock_threshold: 5 }))
      assert.equal(response.low_stock_threshold, 5)
    })

    it("passes cash_register_enabled as-is", () => {
      const response = mapSettingsToResponse(makeSettings({ cash_register_enabled: false }))
      assert.equal(response.cash_register_enabled, false)
    })
  })
})
