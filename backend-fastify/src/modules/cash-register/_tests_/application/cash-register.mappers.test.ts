import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapSession } from "../../application/common/cash-register.mappers"
import type { ICashSessionEntity } from "../../domain/cash-register.entities"

function makeEntity(overrides: Partial<ICashSessionEntity> = {}): ICashSessionEntity {
  return {
    id: "session-1",
    store_id: "store-1",
    user_id: "user-1",
    user_name: "Usuario Uno",
    label: "Caja Uno",
    status: "abierto",
    opening_amount: 100,
    closing_amount_counted: 250,
    expected_amount: 240,
    difference: 10,
    observations: "obs",
    opened_at: new Date("2026-09-01T10:00:00Z"),
    closed_at: new Date("2026-09-01T18:00:00Z"),
    ...overrides,
  }
}

describe("cash-register mappers", () => {
  describe("mapSession", () => {
    it("mapea los campos passthrough", () => {
      const res = mapSession(makeEntity())
      assert.equal(res.id, "session-1")
      assert.equal(res.store_id, "store-1")
      assert.equal(res.user_id, "user-1")
      assert.equal(res.user_name, "Usuario Uno")
      assert.equal(res.label, "Caja Uno")
      assert.equal(res.status, "abierto")
      assert.equal(res.observations, "obs")
    })

    it("casta status a union abierto/cerrado", () => {
      const open = mapSession(makeEntity({ status: "abierto" }))
      assert.equal(open.status, "abierto")
      const closed = mapSession(makeEntity({ status: "cerrado" }))
      assert.equal(closed.status, "cerrado")
    })

    it("convierte opening_amount a Number", () => {
      const res = mapSession(makeEntity({ opening_amount: "150.5" as unknown as number }))
      assert.equal(res.opening_amount, 150.5)
    })

    it("convierte closing_amount_counted a Number", () => {
      const res = mapSession(makeEntity({ closing_amount_counted: "250.5" as unknown as number }))
      assert.equal(res.closing_amount_counted, 250.5)
    })

    it("deja closing_amount_counted undefined cuando es null", () => {
      const res = mapSession(makeEntity({ closing_amount_counted: null }))
      assert.equal(res.closing_amount_counted, undefined)
    })

    it("convierte expected_amount a Number", () => {
      const res = mapSession(makeEntity({ expected_amount: "240.5" as unknown as number }))
      assert.equal(res.expected_amount, 240.5)
    })

    it("deja expected_amount undefined cuando es null", () => {
      const res = mapSession(makeEntity({ expected_amount: null }))
      assert.equal(res.expected_amount, undefined)
    })

    it("convierte difference a Number", () => {
      const res = mapSession(makeEntity({ difference: "10.5" as unknown as number }))
      assert.equal(res.difference, 10.5)
    })

    it("deja difference undefined cuando es null", () => {
      const res = mapSession(makeEntity({ difference: null }))
      assert.equal(res.difference, undefined)
    })

    it("convierte opened_at Date a ISO string", () => {
      const res = mapSession(makeEntity())
      assert.equal(typeof res.opened_at, "string")
      assert.equal(res.opened_at, "2026-09-01T10:00:00.000Z")
    })

    it("pasa opened_at string tal cual cuando no es Date", () => {
      const res = mapSession(makeEntity({ opened_at: "2026-09-01T10:00:00.000Z" as unknown as Date }))
      assert.equal(res.opened_at, "2026-09-01T10:00:00.000Z")
    })

    it("convierte closed_at Date a ISO string", () => {
      const res = mapSession(makeEntity())
      assert.equal(res.closed_at, "2026-09-01T18:00:00.000Z")
    })

    it("pasa closed_at string tal cual cuando no es Date", () => {
      const res = mapSession(makeEntity({ closed_at: "2026-09-01T18:00:00.000Z" as unknown as Date }))
      assert.equal(res.closed_at, "2026-09-01T18:00:00.000Z")
    })

    it("deja closed_at undefined cuando es null", () => {
      const res = mapSession(makeEntity({ closed_at: null }))
      assert.equal(res.closed_at, undefined)
    })

    it("deja closed_at undefined cuando es undefined", () => {
      const res = mapSession(makeEntity({ closed_at: undefined }))
      assert.equal(res.closed_at, undefined)
    })

    it("deja label undefined cuando es null", () => {
      const res = mapSession(makeEntity({ label: null }))
      assert.equal(res.label, undefined)
    })

    it("deja label undefined cuando es undefined", () => {
      const res = mapSession(makeEntity({ label: undefined }))
      assert.equal(res.label, undefined)
    })

    it("deja observations undefined cuando es null", () => {
      const res = mapSession(makeEntity({ observations: null }))
      assert.equal(res.observations, undefined)
    })
  })
})
