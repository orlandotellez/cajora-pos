import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { createSubscriptionService } from "./subscription.service"
import { paypalClient } from "../infrastructure/paypal.client"
import type { ISubscriptionRepository } from "../domain/subscription.interface"
import type { ISubscriptionEntity } from "../domain/subscription.entities"
import type { NewSubscriptionEvent } from "../domain/subscription-event.interface"

const DAY_MS = 86_400_000

/** Fixture de una fila de suscripción. */
function makeEntity(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  const now = new Date()
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "trial",
    paypal_subscription_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    trial_ends_at: new Date(now.getTime() + 14 * DAY_MS),
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/** Repositorio en memoria: controla getByStoreId/update/upsertCloud sin tocar Prisma. */
function makeRepo(initial: ISubscriptionEntity | null = null) {
  let current = initial
  const repo: ISubscriptionRepository = {
    async getByStoreId() { return current },
    async getByPaypalSubscriptionId() { return null },
    async findPaypalSubscriptions() { return current ? [current] : [] },
    async upsertCloud(storeId, data) {
      current = makeEntity({ store_id: storeId, ...data })
      return current
    },
    async update(storeId, data) {
      if (!current) return null
      current = { ...current, ...data, store_id: storeId } as ISubscriptionEntity
      return current
    },
  }
  return { repo, getCurrent: () => current }
}

/** Repositorio de eventos en memoria: captura lo auditado. */
function fakeEventRepo(created: Array<NewSubscriptionEvent>) {
  return {
    async create(data: NewSubscriptionEvent) {
      created.push(data)
    },
    async findMany() {
      return []
    },
    async count() {
      return 0
    },
  }
}

describe("SubscriptionService", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  describe("elegirCloud", () => {
    it("crea una fila cloud con trial de 14 días si no existía", async () => {
      const { repo, getCurrent } = makeRepo()
      const service = createSubscriptionService(repo)

      const res = await service.elegirCloud("store-1")

      assert.equal(res.mode, "cloud")
      assert.equal(res.status, "trial")
      assert.equal(res.paypal_subscription_id, null)
      const trialEnds = new Date(getCurrent()!.trial_ends_at!).getTime()
      const diff = trialEnds - Date.now()
      assert.ok(diff > 13 * DAY_MS && diff <= 14 * DAY_MS, "trial_ends_at debe ser ~14 días")
    })

    it("NO degrada a una tienda que ya tiene suscripción PayPal", async () => {
      const existing = makeEntity({
        paypal_subscription_id: "I-BUY-123",
        status: "active",
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.elegirCloud("store-1")

      // No se toca la fila: sigue active con el paypal id original
      assert.equal(res.status, "active")
      assert.equal(res.paypal_subscription_id, "I-BUY-123")
      assert.equal(getCurrent()!.status, "active")
    })
  })

  describe("checkout", () => {
    it("crea la suscripción en PayPal y guarda el paypal_subscription_id", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-1",
        approvalUrl: "https://paypal.com/approve/1",
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const { repo, getCurrent } = makeRepo()
      const service = createSubscriptionService(repo)

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-PAYPAL-1")
      assert.equal(res.approvalUrl, "https://paypal.com/approve/1")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-1")
      // La fila fue asegurada como trial (tienda self_hosted que va directo a checkout)
      assert.equal(getCurrent()!.status, "trial")
    })

    it("si la tienda ya es cloud, no duplica la fila (mantiene status)", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-2",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const existing = makeEntity()
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(getCurrent()!.status, "trial")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-2")
    })
  })

  describe("activate", () => {
    it("activa la suscripción con período de 30 días y limpia el trial", async () => {
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.activate("store-1", "I-PAYPAL-1")

      assert.equal(res.status, "active")
      assert.equal(res.trial_ends_at, null)
      const start = new Date(res.current_period_start!).getTime()
      const end = new Date(res.current_period_end!).getTime()
      assert.ok(end - start >= 29 * DAY_MS && end - start <= 30 * DAY_MS)
    })

    it("es idempotente: reactivar con el mismo id vuelve a funcionar", async () => {
      const active = makeEntity({ status: "active", paypal_subscription_id: "I-PAYPAL-1" })
      const { repo } = makeRepo(active)
      const service = createSubscriptionService(repo)

      const res = await service.activate("store-1", "I-PAYPAL-1")
      assert.equal(res.status, "active")
    })

    it("lanza ConflictError si la sub no pertenece a la tienda", async () => {
      const existing = makeEntity({ paypal_subscription_id: "I-OTRO" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.activate("store-1", "I-AJENO"),
        /no pertenece a esta tienda/,
      )
    })
  })

  describe("cancel", () => {
    it("cancela en PayPal y marca cancel_at_period_end sin degradar a canceled", async () => {
      const cancelSpy = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1", status: "active" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.cancel("store-1")

      assert.equal(cancelSpy.mock.callCount(), 1)
      assert.equal(res.status, "active") // sigue activo hasta fin de período
      assert.equal(res.cancel_at_period_end, true)
      assert.equal(getCurrent()!.cancel_at_period_end, true)
    })

    it("lanza ConflictError si no hay suscripción activa", async () => {
      const { repo } = makeRepo()
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.cancel("store-1"), /No hay suscripción activa/)
    })
  })

  describe("reactivate", () => {
    it("crea fila trial si no existía", async () => {
      const { repo, getCurrent } = makeRepo()
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "trial")
      assert.ok(getCurrent()!.trial_ends_at)
    })

    it("no-op si ya está activa (idempotente)", async () => {
      const existing = makeEntity({ status: "active", paypal_subscription_id: "I-PAYPAL-1" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "active")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-1")
    })

    it("activa con cancelación programada → cancela la cancelación (sigue activa)", async () => {
      const existing = makeEntity({
        status: "active",
        cancel_at_period_end: true,
        paypal_subscription_id: "I-PAYPAL-1",
      })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      const res = await service.reactivate("store-1", { userId: "user-1", ip: null, userAgent: null })

      assert.equal(res.status, "active")
      assert.equal(res.cancel_at_period_end, false)
      assert.equal(getCurrent()!.cancel_at_period_end, false)
      assert.equal(created.length, 1)
      assert.equal(created[0].action, "reactivate")
    })

    it("reabre el flujo desde canceled (estado trial, sin paypal id viejo)", async () => {
      const existing = makeEntity({ status: "canceled", paypal_subscription_id: "I-PAYPAL-1" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "trial")
      assert.equal(getCurrent()!.status, "trial")
    })
  })

  describe("auditoría", () => {
    it("elegirCloud audita el alta con el usuario", async () => {
      const { repo } = makeRepo()
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.elegirCloud("store-1", { userId: "user-2", ip: null, userAgent: null })

      assert.equal(created.length, 1)
      assert.equal(created[0].action, "cloud")
      assert.equal(created[0].user_id, "user-2")
      assert.equal(created[0].store_id, "store-1")
    })

    it("checkout audita la creación con el paypal id", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-1",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const { repo } = makeRepo()
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.checkout("store-1", "https://ok", "https://cancel", {
        userId: "user-1",
        ip: "10.0.0.1",
        userAgent: "landing",
      })

      assert.equal(created.length, 1)
      assert.equal(created[0].action, "checkout")
      assert.equal(created[0].paypal_subscription_id, "I-PAYPAL-1")
      assert.equal(created[0].user_id, "user-1")
    })

    it("cancel audita quién canceló (userId, ip, userAgent) y con qué paypal id", async () => {
      mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1", status: "active" })
      const { repo } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.cancel("store-1", { userId: "user-1", ip: "1.2.3.4", userAgent: "postman" })

      assert.equal(created.length, 1)
      assert.equal(created[0].action, "cancel")
      assert.equal(created[0].user_id, "user-1")
      assert.deepEqual(created[0].metadata, { ip: "1.2.3.4", userAgent: "postman" })
      assert.equal(created[0].paypal_subscription_id, "I-PAYPAL-1")
    })

    it("reactivate audita la reapertura", async () => {
      const existing = makeEntity({ status: "canceled", paypal_subscription_id: "I-PAYPAL-1" })
      const { repo } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.reactivate("store-1", { userId: "user-9", ip: null, userAgent: null })

      assert.equal(created.length, 1)
      assert.equal(created[0].action, "reactivate")
      assert.equal(created[0].user_id, "user-9")
    })
  })

  describe("getByStore", () => {
    it("sin fila → devuelve self_hosted activo (gratis, sin gateo)", async () => {
      const { repo } = makeRepo()
      const service = createSubscriptionService(repo)

      const res = await service.getByStore("store-1")

      assert.equal(res.mode, "self_hosted")
      assert.equal(res.status, "active")
      assert.equal(res.paypal_subscription_id, null)
    })

    it("con fila → devuelve el estado real", async () => {
      const existing = makeEntity({ status: "past_due" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.getByStore("store-1")

      assert.equal(res.mode, "cloud")
      assert.equal(res.status, "past_due")
    })
  })

  describe("getBilling", () => {
    it("arma el historial de cobros con el monto real del webhook y la próxima fecha", async () => {
      const paidAt = new Date("2026-08-01T12:00:00Z")
      const events = [
        {
          id: "ev-1",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { event_id: "wh-1" },
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async findMany() {
          return events
        },
        async count() {
          return 1
        },
      }
      const webhookRepo = {
        async insert() {
          throw new Error("no usado")
        },
        async markProcessed() {},
        async findByEventIds() {
          return [
            {
              event_id: "wh-1",
              payload: { resource: { amount: { total: "15.99", currency: "USD" } } },
            },
          ]
        },
      }

      const periodEnd = new Date("2026-09-01T12:00:00Z")
      const { repo } = makeRepo(
        makeEntity({ status: "active", current_period_end: periodEnd }),
      )
      const service = createSubscriptionService(repo, eventRepo, webhookRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "15.99")
      assert.equal(res.payments[0].currency, "USD")
      assert.equal(res.payments[0].paid_at, "2026-08-01T12:00:00.000Z")
      assert.equal(res.total_paid, "15.99")
      assert.equal(res.next_payment_at, "2026-09-01T12:00:00.000Z")
    })

    it("sin cobros → payments vacío, total 0 y sin próxima fecha si no hay período", async () => {
      const eventRepo = {
        async create() {},
        async findMany() {
          return []
        },
        async count() {
          return 0
        },
      }
      const { repo } = makeRepo()
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.deepEqual(res.payments, [])
      assert.equal(res.total_paid, "0.00")
      assert.equal(res.next_payment_at, null)
    })
  })
})
