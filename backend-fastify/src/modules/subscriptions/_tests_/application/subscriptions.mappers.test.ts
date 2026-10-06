import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapToResponse } from "../../application/common/subscriptions.mappers"
import type { ISubscriptionEntity } from "../../domain/subscription.entities"

/**
 * `mapToResponse` resuelve el estado contra el reloj, así que los fixtures usan
 * fechas absolutas y la resolución se congela en `NOW` (no en `Date.now()`, que
 * pudriría el fixture solo con el paso del tiempo).
 */
const NOW = new Date("2026-09-15T10:00:00Z")

function makeEntity(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "active",
    paypal_subscription_id: "paypal-1",
    current_period_start: new Date("2026-09-01T10:00:00Z"),
    current_period_end: new Date("2026-10-01T10:00:00Z"),
    cancel_at_period_end: false,
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

describe("subscriptions mappers", () => {
  describe("mapToResponse", () => {
    it("mapea los campos passthrough", () => {
      const res = mapToResponse(makeEntity(), NOW)
      assert.equal(res.mode, "cloud")
      assert.equal(res.plan, "monthly")
      assert.equal(res.status, "active")
      assert.equal(res.paypal_subscription_id, "paypal-1")
      assert.equal(res.cancel_at_period_end, false)
    })

    it("convierte current_period_start Date a ISO string", () => {
      const res = mapToResponse(makeEntity(), NOW)
      assert.equal(typeof res.current_period_start, "string")
      assert.equal(res.current_period_start, "2026-09-01T10:00:00.000Z")
    })

    it("convierte current_period_end Date a ISO string", () => {
      const res = mapToResponse(makeEntity(), NOW)
      assert.equal(typeof res.current_period_end, "string")
      assert.equal(res.current_period_end, "2026-10-01T10:00:00.000Z")
    })

    it("deja current_period_start como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ current_period_start: null }), NOW)
      assert.equal(res.current_period_start, null)
    })

    it("deja current_period_end como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ current_period_end: null }), NOW)
      assert.equal(res.current_period_end, null)
    })

    it("deja paypal_subscription_id como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ paypal_subscription_id: null }), NOW)
      assert.equal(res.paypal_subscription_id, null)
    })

    it("mantiene cancel_at_period_end true", () => {
      const res = mapToResponse(makeEntity({ cancel_at_period_end: true }), NOW)
      assert.equal(res.cancel_at_period_end, true)
    })

    it("mantiene otros valores de mode, plan y status", () => {
      const res = mapToResponse(makeEntity({
        mode: "self_hosted",
        plan: "annual",
        status: "expired",
      }), NOW)
      assert.equal(res.mode, "self_hosted")
      assert.equal(res.plan, "annual")
      assert.equal(res.status, "expired")
    })

    it("expone grace_ends_at y days_overdue del período vigente", () => {
      const res = mapToResponse(makeEntity(), NOW)
      assert.equal(res.grace_ends_at, "2026-10-04T10:00:00.000Z", "fin de período + 3 días")
      assert.equal(res.days_overdue, 0)
    })

    it("una fila active con el período ya vencido sale como expired (el reloj manda)", () => {
      const res = mapToResponse(makeEntity(), new Date("2026-11-20T10:00:00Z"))
      assert.equal(res.status, "expired")
      assert.equal(res.days_overdue, 47)
      assert.equal(res.current_period_end, "2026-10-01T10:00:00.000Z", "el período pagado se conserva")
    })
  })
})
