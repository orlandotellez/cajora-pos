import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { createReconciliationService } from "./reconciliation.service"
import { paypalClient } from "../infrastructure/paypal.client"
import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type { ISubscriptionEntity } from "../domain/subscription.entities"

const DAY_MS = 86_400_000

const logger = { info: () => {}, warn: () => {}, error: () => {} }

/** Fixture de una fila de suscripción. */
function makeEntity(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  const now = new Date()
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "active",
    paypal_subscription_id: "I-ACTIVE123",
    current_period_start: now,
    current_period_end: new Date(now.getTime() + 30 * DAY_MS),
    cancel_at_period_end: false,
    trial_ends_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/** Repositorio en memoria: pagina filas y registra updates sin tocar Prisma. */
function makeRepo(subs: ISubscriptionEntity[]) {
  let rows = [...subs]
  const updated: Array<Partial<ISubscriptionEntity>> = []
  const repo: ISubscriptionRepository = {
    async getByStoreId() { return null },
    async getByPaypalSubscriptionId() { return null },
    findPaypalSubscriptions: async (skip, take) => rows.slice(skip, skip + take),
    async upsertCloud() { throw new Error("no usado en este test") },
    async update(storeId, data) {
      updated.push(data)
      const idx = rows.findIndex((r) => r.store_id === storeId)
      if (idx === -1) return null
      rows[idx] = { ...rows[idx], ...data } as ISubscriptionEntity
      return rows[idx]
    },
  }
  return { repo, getRows: () => rows, updated }
}

function paypalActive(nextBillingTime: string | null) {
  mock.method(paypalClient, "getSubscription", async (id: string) => ({
    id,
    status: "ACTIVE",
    nextBillingTime,
  }))
}

describe("ReconciliationService", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("modo mock (PAYPAL_ENABLED=false) → skip sin tocar PayPal ni la DB", async () => {
    mock.property(env, "PAYPAL_ENABLED", false)
    let called = false
    mock.method(paypalClient, "getSubscription", async () => {
      called = true
      throw new Error("no debe llamarse")
    })
    const { repo, updated } = makeRepo([makeEntity()])
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.deepEqual(stats, { reviewed: 0, drifted: 0, errors: 0 })
    assert.equal(updated.length, 0)
    assert.equal(called, false)
  })

  it("ACTIVE con período vigente → no toca nada (0 drift)", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, updated } = makeRepo([
      makeEntity({ status: "active", current_period_end: new Date(Date.now() + 10 * DAY_MS) }),
    ])
    paypalActive(new Date(Date.now() + 30 * DAY_MS).toISOString())
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.deepEqual(stats, { reviewed: 1, drifted: 0, errors: 0 })
    assert.equal(updated.length, 0)
  })

  it("ACTIVE con período VENCIDO y next_billing_time futuro → extiende el período (SALE perdido)", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const nextBilling = new Date(Date.now() + 28 * DAY_MS)
    const { repo, getRows, updated } = makeRepo([
      makeEntity({ status: "active", current_period_end: new Date(Date.now() - 2 * DAY_MS) }),
    ])
    paypalActive(nextBilling.toISOString())
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.equal(stats.drifted, 1)
    assert.equal(updated.length, 1)
    const row = getRows()[0]
    assert.equal(row.status, "active")
    assert.ok(row.current_period_end)
    assert.ok(Math.abs(row.current_period_end.getTime() - nextBilling.getTime()) < 1000)
  })

  it("ACTIVE sobre una sub en trial sin período → activa con período desde next_billing_time (ACTIVATED perdido)", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const nextBilling = new Date(Date.now() + 30 * DAY_MS)
    const { repo, getRows } = makeRepo([
      makeEntity({
        status: "trial",
        paypal_subscription_id: "I-APPROVED",
        current_period_start: null,
        current_period_end: null,
      }),
    ])
    paypalActive(nextBilling.toISOString())
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.equal(stats.drifted, 1)
    const row = getRows()[0]
    assert.equal(row.status, "active")
    assert.ok(row.current_period_start)
    assert.ok(row.current_period_end)
  })

  it("CANCELLED → canceled + cancel_at_period_end", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, getRows } = makeRepo([makeEntity({ status: "active" })])
    mock.method(paypalClient, "getSubscription", async (id: string) => ({
      id,
      status: "CANCELLED",
      nextBillingTime: null,
    }))
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.equal(stats.drifted, 1)
    assert.equal(getRows()[0].status, "canceled")
    assert.equal(getRows()[0].cancel_at_period_end, true)
  })

  it("SUSPENDED → past_due", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, getRows } = makeRepo([makeEntity({ status: "active" })])
    mock.method(paypalClient, "getSubscription", async (id: string) => ({
      id,
      status: "SUSPENDED",
      nextBillingTime: null,
    }))
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.equal(stats.drifted, 1)
    assert.equal(getRows()[0].status, "past_due")
  })

  it("EXPIRED → expired + cancel_at_period_end", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, getRows } = makeRepo([makeEntity({ status: "past_due" })])
    mock.method(paypalClient, "getSubscription", async (id: string) => ({
      id,
      status: "EXPIRED",
      nextBillingTime: null,
    }))
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.equal(stats.drifted, 1)
    assert.equal(getRows()[0].status, "expired")
    assert.equal(getRows()[0].cancel_at_period_end, true)
  })

  it("APPROVAL_PENDING → no toca (sigue el flujo de aprobación)", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, updated } = makeRepo([makeEntity({ status: "trial" })])
    mock.method(paypalClient, "getSubscription", async (id: string) => ({
      id,
      status: "APPROVAL_PENDING",
      nextBillingTime: null,
    }))
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.deepEqual(stats, { reviewed: 1, drifted: 0, errors: 0 })
    assert.equal(updated.length, 0)
  })

  it("error de red en UNA sub → no rompe la pasada: el resto se procesa y se contabiliza", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const bad = makeEntity({ store_id: "store-bad", paypal_subscription_id: "I-BAD" })
    const good = makeEntity({ store_id: "store-good", paypal_subscription_id: "I-GOOD" })
    const { repo, getRows } = makeRepo([bad, good])
    mock.method(paypalClient, "getSubscription", async (id: string) => {
      if (id === "I-BAD") throw new AppError("red caída", 502, "PAYPAL_NETWORK_ERROR")
      return { id, status: "CANCELLED", nextBillingTime: null }
    })
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.deepEqual(stats, { reviewed: 2, drifted: 1, errors: 1 })
    assert.equal(getRows()[0].status, "active") // la "bad" no se tocó (quedó como estaba)
    assert.equal(getRows()[1].status, "canceled") // la "good" sí
  })

  it("sin suscripciones con PayPal → 0 revisadas (paginación vacía corta el loop)", async () => {
    mock.property(env, "PAYPAL_ENABLED", true)
    const { repo, updated } = makeRepo([])
    mock.method(paypalClient, "getSubscription", async (id: string) => ({ id, status: "ACTIVE", nextBillingTime: null }))
    const service = createReconciliationService(repo)

    const stats = await service.run(logger)

    assert.deepEqual(stats, { reviewed: 0, drifted: 0, errors: 0 })
    assert.equal(updated.length, 0)
  })
})