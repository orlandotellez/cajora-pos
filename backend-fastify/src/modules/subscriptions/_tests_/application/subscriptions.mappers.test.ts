import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mapToResponse } from "../../application/common/subscriptions.mappers"
import type { ISubscriptionEntity } from "../../domain/subscription.entities"

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
      const res = mapToResponse(makeEntity())
      assert.equal(res.mode, "cloud")
      assert.equal(res.plan, "monthly")
      assert.equal(res.status, "active")
      assert.equal(res.paypal_subscription_id, "paypal-1")
      assert.equal(res.cancel_at_period_end, false)
    })

    it("convierte current_period_start Date a ISO string", () => {
      const res = mapToResponse(makeEntity())
      assert.equal(typeof res.current_period_start, "string")
      assert.equal(res.current_period_start, "2026-09-01T10:00:00.000Z")
    })

    it("convierte current_period_end Date a ISO string", () => {
      const res = mapToResponse(makeEntity())
      assert.equal(typeof res.current_period_end, "string")
      assert.equal(res.current_period_end, "2026-10-01T10:00:00.000Z")
    })

    it("deja current_period_start como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ current_period_start: null }))
      assert.equal(res.current_period_start, null)
    })

    it("deja current_period_end como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ current_period_end: null }))
      assert.equal(res.current_period_end, null)
    })

    it("deja paypal_subscription_id como null cuando es null", () => {
      const res = mapToResponse(makeEntity({ paypal_subscription_id: null }))
      assert.equal(res.paypal_subscription_id, null)
    })

    it("mantiene cancel_at_period_end true", () => {
      const res = mapToResponse(makeEntity({ cancel_at_period_end: true }))
      assert.equal(res.cancel_at_period_end, true)
    })

    it("mantiene otros valores de mode, plan y status", () => {
      const res = mapToResponse(makeEntity({
        mode: "self_hosted",
        plan: "annual",
        status: "expired",
      }))
      assert.equal(res.mode, "self_hosted")
      assert.equal(res.plan, "annual")
      assert.equal(res.status, "expired")
    })
  })
})
