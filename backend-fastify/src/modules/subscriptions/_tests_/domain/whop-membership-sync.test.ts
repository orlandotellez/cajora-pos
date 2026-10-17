import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildMembershipUpdate, translateWhopStatus } from "../../domain/whop-membership-sync"
import type { WhopMembership } from "../../infrastructure/whop.client"
import type { ISubscriptionEntity } from "../../domain/subscription.entities"

const DAY_MS = 86_400_000

function makeMembership(overrides: Partial<WhopMembership> = {}): WhopMembership {
  return {
    id: "mem-1",
    status: "active",
    user: { id: "whop-user-1", email: "a@b.c", username: "u" },
    renewal_period_start: null,
    renewal_period_end: null,
    cancel_at_period_end: false,
    metadata: null,
    plan: null,
    product: null,
    ...overrides,
  }
}

function makeSub(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  const now = new Date()
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "pending",
    provider: "whop",
    paypal_subscription_id: null,
    whop_membership_id: "mem-1",
    whop_user_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe("translateWhopStatus", () => {
  it("active/trialing/completed → active y sincroniza el flag que reporta Whop", () => {
    for (const status of ["active", "trialing", "completed"] as const) {
      const translated = translateWhopStatus(makeMembership({ status, cancel_at_period_end: true }))
      assert.equal(translated?.status, "active", `status ${status}`)
      assert.equal(translated?.cancelAtPeriodEnd, true, `flag ${status}`)
      assert.equal(translated?.action, "webhook_whop_activated")
    }
  })

  it("past_due → past_due sin flag de cancelación", () => {
    const translated = translateWhopStatus(makeMembership({ status: "past_due" }))
    assert.equal(translated?.status, "past_due")
    assert.equal(translated?.cancelAtPeriodEnd, false)
    assert.equal(translated?.action, "webhook_whop_past_due")
  })

  it("canceled → canceled con flag true", () => {
    const translated = translateWhopStatus(makeMembership({ status: "canceled" }))
    assert.equal(translated?.status, "canceled")
    assert.equal(translated?.cancelAtPeriodEnd, true)
    assert.equal(translated?.action, "webhook_whop_canceled")
  })

  it("expired → expired con flag true", () => {
    const translated = translateWhopStatus(makeMembership({ status: "expired" }))
    assert.equal(translated?.status, "expired")
    assert.equal(translated?.cancelAtPeriodEnd, true)
    assert.equal(translated?.action, "webhook_whop_expired")
  })

  it("unresolved/drafting y cualquier otro estado → null (no toca la DB)", () => {
    assert.equal(translateWhopStatus(makeMembership({ status: "unresolved" })), null)
    assert.equal(translateWhopStatus(makeMembership({ status: "drafting" })), null)
    assert.equal(translateWhopStatus(makeMembership({ status: "desconocido" as never })), null)
  })
})

describe("buildMembershipUpdate", () => {
  it("toma el período de renewal_period_* cuando Whop lo reporta", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const start = new Date(now.getTime())
    const end = new Date(now.getTime() + 30 * DAY_MS)
    const membership = makeMembership({
      renewal_period_start: start.toISOString(),
      renewal_period_end: end.toISOString(),
    })

    const update = buildMembershipUpdate(membership, makeSub({ status: "pending" }), now)

    assert.equal(update?.status, "active")
    assert.equal(update?.current_period_start?.getTime(), start.getTime())
    assert.equal(update?.current_period_end?.getTime(), end.getTime())
  })

  it("conserva el start guardado cuando falta renewal_period_start", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const storedStart = new Date(now.getTime() - 5 * DAY_MS)
    const end = new Date(now.getTime() + 20 * DAY_MS)
    const membership = makeMembership({
      renewal_period_start: null,
      renewal_period_end: end.toISOString(),
    })

    const update = buildMembershipUpdate(
      membership,
      makeSub({ status: "pending", current_period_start: storedStart }),
      now,
    )

    assert.equal(update?.current_period_start?.getTime(), storedStart.getTime())
    assert.equal(update?.current_period_end?.getTime(), end.getTime())
  })

  it("con período guardado vencido y sin renewal_period_end → otorga 30 días nuevos", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const membership = makeMembership({ renewal_period_start: null, renewal_period_end: null })

    const update = buildMembershipUpdate(
      membership,
      makeSub({ status: "active", current_period_end: new Date(now.getTime() - DAY_MS) }),
      now,
    )

    assert.equal(update?.current_period_start?.getTime(), now.getTime())
    const days = (update!.current_period_end!.getTime() - now.getTime()) / DAY_MS
    assert.equal(days, 30, "período nuevo de 30 días")
  })

  it("nunca recorta un período vigente cuando falta renewal_period_end → null", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const membership = makeMembership({ renewal_period_start: null, renewal_period_end: null, user: null })

    const update = buildMembershipUpdate(
      membership,
      makeSub({ status: "active", current_period_end: new Date(now.getTime() + 20 * DAY_MS) }),
      now,
    )

    assert.equal(update, null, "un período en curso no se toca")
  })

  it("estado sin traducción → null", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    assert.equal(buildMembershipUpdate(makeMembership({ status: "unresolved" }), makeSub(), now), null)
  })

  it("incluye whop_user_id cuando la membership trae usuario", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const update = buildMembershipUpdate(
      makeMembership({ user: { id: "whop-user-9", email: "a@b.c", username: "u" } }),
      makeSub({ status: "pending" }),
      now,
    )

    assert.equal(update?.whop_user_id, "whop-user-9")
  })

  it("una fila ya sincronizada no produce update (drift null)", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const start = new Date(now.getTime())
    const end = new Date(now.getTime() + 30 * DAY_MS)
    const membership = makeMembership({
      renewal_period_start: start.toISOString(),
      renewal_period_end: end.toISOString(),
      cancel_at_period_end: false,
    })
    const sub = makeSub({
      status: "active",
      cancel_at_period_end: false,
      current_period_start: start,
      current_period_end: end,
      whop_user_id: "whop-user-1",
    })

    assert.equal(buildMembershipUpdate(membership, sub, now), null)
  })
})
