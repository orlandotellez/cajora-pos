import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createSettingsService } from "../../application/settings.service"
import type { ISettingsRepository } from "../../domain/settings.interface"
import type { ISettingsEntity } from "../../domain/settings.entities"

function makeSettings(overrides: Partial<ISettingsEntity> = {}): ISettingsEntity {
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
  }
}

function makeFakeRepo(overrides: Partial<ISettingsRepository> = {}): ISettingsRepository {
  return {
    get: async () => makeSettings(),
    upsert: async (data, _storeId) => makeSettings({ ...data }),
    ...overrides,
  }
}

describe("settings service", () => {
  describe("get", () => {
    it("returns mapped settings when they exist", async () => {
      const repo = makeFakeRepo()
      const service = createSettingsService(repo)

      const result = await service.get("store-1")

      assert.equal(result.name, "Mi Negocio")
      assert.equal(result.low_stock_threshold, 10)
      assert.equal(result.cash_register_enabled, true)
      assert.equal(result.address, "Av. Principal 789")
      assert.equal(typeof result.updated_at, "string")
    })

    it("returns defaults when the repo returns null", async () => {
      const repo = makeFakeRepo({ get: async () => null })
      const service = createSettingsService(repo)

      const result = await service.get("store-1")

      assert.equal(result.name, "")
      assert.equal(result.low_stock_threshold, 5)
      assert.equal(result.cash_register_enabled, true)
      assert.equal(typeof result.updated_at, "string")
    })
  })

  describe("update", () => {
    it("updates only the provided fields (partial)", async () => {
      let captured: Record<string, unknown> | undefined
      const repo = makeFakeRepo({
        upsert: async (data, _storeId) => {
          captured = data
          return makeSettings({ ...data })
        },
      })
      const service = createSettingsService(repo)

      const result = await service.update({ low_stock_threshold: 8 }, "store-1")

      assert.equal(result.low_stock_threshold, 8)
      assert.equal(captured?.low_stock_threshold, 8)
      assert.equal("name" in (captured ?? {}), false)
    })

    it("updates name and cash register flag together", async () => {
      const repo = makeFakeRepo({
        upsert: async (data) => makeSettings({ ...data }),
      })
      const service = createSettingsService(repo)

      const result = await service.update({ name: "Nuevo Negocio", cash_register_enabled: false }, "store-1")

      assert.equal(result.name, "Nuevo Negocio")
      assert.equal(result.cash_register_enabled, false)
    })

    it("handles optional empty string fields", async () => {
      const repo = makeFakeRepo({
        upsert: async () => makeSettings({ address: "", phone: "", ticket_footer: "" }),
      })
      const service = createSettingsService(repo)

      const result = await service.update({ address: "", phone: "", ticket_footer: "" }, "store-1")

      assert.equal(result.address, undefined)
      assert.equal(result.phone, undefined)
      assert.equal(result.ticket_footer, undefined)
    })
  })

  describe("isCashRegisterEnabled", () => {
    it("returns true when settings exist and cash register is enabled", async () => {
      const repo = makeFakeRepo({ get: async () => makeSettings({ cash_register_enabled: true }) })
      const service = createSettingsService(repo)

      const enabled = await service.isCashRegisterEnabled("store-1")

      assert.equal(enabled, true)
    })

    it("returns false when settings exist and cash register is disabled", async () => {
      const repo = makeFakeRepo({ get: async () => makeSettings({ cash_register_enabled: false }) })
      const service = createSettingsService(repo)

      const enabled = await service.isCashRegisterEnabled("store-1")

      assert.equal(enabled, false)
    })

    it("returns true (default) when there are no settings", async () => {
      const repo = makeFakeRepo({ get: async () => null })
      const service = createSettingsService(repo)

      const enabled = await service.isCashRegisterEnabled("store-1")

      assert.equal(enabled, true)
    })
  })
})
