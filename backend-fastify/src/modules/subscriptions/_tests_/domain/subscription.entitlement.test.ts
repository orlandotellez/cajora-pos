import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GRACE_DAYS, resolveEntitlement } from "../../domain/subscription.entitlement"
import type { ISubscriptionEntity } from "../../domain/subscription.entities"

const NOW = new Date("2026-10-05T12:00:00Z")
const PERIOD_END = new Date("2026-09-11T12:00:00Z")

function daysFromNow(days: number, from = NOW): Date {
  return new Date(from.getTime() + days * 86_400_000)
}

function makeSub(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "active",
    paypal_subscription_id: "I-J2RAVAFHH9AR",
    current_period_start: new Date("2026-08-12T12:00:00Z"),
    current_period_end: PERIOD_END,
    cancel_at_period_end: false,
    created_at: new Date("2026-08-12T12:00:00Z"),
    updated_at: new Date("2026-08-12T12:00:00Z"),
    ...overrides,
  }
}

describe("subscriptions entitlement", () => {
  describe("resolveEntitlement", () => {
    it("active con período vigente → permitido", () => {
      const result = resolveEntitlement(makeSub({ current_period_end: daysFromNow(10) }), NOW)

      assert.equal(result.state, "active")
      assert.equal(result.allowed, true)
      assert.equal(result.daysOverdue, 0)
    })

    it("active dentro del período de gracia → permitido", () => {
      const result = resolveEntitlement(
        makeSub({ current_period_end: daysFromNow(-2) }),
        NOW,
      )

      assert.equal(result.state, "active")
      assert.equal(result.allowed, true)
      assert.equal(result.daysOverdue, 0)
    })

    it("active pasado el grace → expired y bloqueado", () => {
      const result = resolveEntitlement(
        makeSub({ current_period_end: daysFromNow(-(GRACE_DAYS + 1)) }),
        NOW,
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
      assert.equal(result.daysOverdue, 1)
    })

    it("exactamente en el límite del grace (now === graceEndsAt) → permitido", () => {
      const periodEnd = new Date("2026-10-02T12:00:00Z")
      const result = resolveEntitlement(
        makeSub({ current_period_end: periodEnd }),
        new Date(periodEnd.getTime() + GRACE_DAYS * 86_400_000),
      )

      assert.equal(result.allowed, true)
      assert.equal(result.daysOverdue, 0)
    })

    it("un milisegundo después del límite del grace → bloqueado", () => {
      const periodEnd = new Date("2026-10-02T12:00:00Z")
      const graceEndsAt = periodEnd.getTime() + GRACE_DAYS * 86_400_000
      const result = resolveEntitlement(
        makeSub({ current_period_end: periodEnd }),
        new Date(graceEndsAt + 1),
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
    })

    it("active sin current_period_end → expired (nada pagado que respalde el acceso)", () => {
      const result = resolveEntitlement(makeSub({ current_period_end: null }), NOW)

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
      assert.equal(result.daysOverdue, null)
      assert.equal(result.graceEndsAt, null)
    })

    it("pending nunca concede acceso, aunque tenga período pagado", () => {
      const result = resolveEntitlement(
        makeSub({ status: "pending", current_period_end: daysFromNow(20) }),
        NOW,
      )

      assert.equal(result.state, "pending")
      assert.equal(result.allowed, false)
    })

    it("pending sin período no rompe el resolver", () => {
      const result = resolveEntitlement(
        makeSub({ status: "pending", current_period_end: null }),
        NOW,
      )

      assert.equal(result.state, "pending")
      assert.equal(result.allowed, false)
    })

    it("past_due dentro del grace → permitido y conserva el estado past_due", () => {
      const result = resolveEntitlement(
        makeSub({ status: "past_due", current_period_end: daysFromNow(-1) }),
        NOW,
      )

      assert.equal(result.state, "past_due")
      assert.equal(result.allowed, true)
    })

    it("past_due pasado el grace → expired y bloqueado", () => {
      const result = resolveEntitlement(
        makeSub({ status: "past_due", current_period_end: daysFromNow(-10) }),
        NOW,
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
      assert.equal(result.daysOverdue, 7)
    })

    it("canceled con período pagado vigente → permitido y conserva el estado canceled", () => {
      const result = resolveEntitlement(
        makeSub({
          status: "canceled",
          cancel_at_period_end: true,
          current_period_end: daysFromNow(20),
        }),
        NOW,
      )

      assert.equal(result.state, "canceled")
      assert.equal(result.allowed, true)
    })

    it("canceled pasado el grace → expired y bloqueado", () => {
      const result = resolveEntitlement(
        makeSub({ status: "canceled", current_period_end: daysFromNow(-5) }),
        NOW,
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
      assert.equal(result.daysOverdue, 2)
    })

    it("expired con período todavía futuro → bloqueado (el estado manda)", () => {
      const result = resolveEntitlement(
        makeSub({ status: "expired", current_period_end: daysFromNow(20) }),
        NOW,
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
    })

    it("expired sin período → bloqueado", () => {
      const result = resolveEntitlement(
        makeSub({ status: "expired", current_period_end: null }),
        NOW,
      )

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
    })

    it("expone graceEndsAt como fin de período + GRACE_DAYS", () => {
      const result = resolveEntitlement(makeSub(), NOW)

      assert.deepEqual(
        result.graceEndsAt,
        new Date(PERIOD_END.getTime() + GRACE_DAYS * 86_400_000),
      )
    })

    it("el caso real reportado: active con período vencido hace 24 días → bloqueado", () => {
      const result = resolveEntitlement(makeSub(), NOW)

      assert.equal(result.state, "expired")
      assert.equal(result.allowed, false)
      assert.equal(result.daysOverdue, 21)
    })
  })
})