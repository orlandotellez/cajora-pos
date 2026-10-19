import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { AppError, ConflictError } from "@/core/errors/AppError"
import { env } from "@/config/env"
import { createSubscriptionService } from "../../application/subscription.service"
import { paypalClient } from "../../infrastructure/paypal.client"
import { whopClient } from "../../infrastructure/whop.client"
import { verifyCheckoutRef } from "../../domain/whop-checkout-ref"
import type { ISubscriptionRepository } from "../../domain/subscription.interface"
import type { ISubscriptionEntity } from "../../domain/subscription.entities"
import { SUBSCRIPTION_EVENT_ACTIONS } from "../../domain/subscription-event.interface"
import type { NewSubscriptionEvent } from "../../domain/subscription-event.interface"
import type { WhopMembership } from "../../domain/whop-membership"

const DAY_MS = 86_400_000

/** Fixture de una fila de suscripción. */
function makeEntity(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  const now = new Date()
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "pending",
    provider: "paypal",
    paypal_subscription_id: null,
    whop_membership_id: null,
    whop_user_id: null,
    // fixture `active` sin período ya no significaría "activa" (y las fechas fijas
    // absolutas se pudren solas). Los tests que necesitan otra cosa lo dicen.
    current_period_start: new Date(now.getTime() - 10 * DAY_MS),
    current_period_end: new Date(now.getTime() + 20 * DAY_MS),
    cancel_at_period_end: false,
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
    async getByWhopMembershipId() { return null },
    async findPaypalSubscriptions() { return current ? [current] : [] },
    async findWhopSubscriptions() { return [] },
    async upsertCloud(storeId, data) {
      // Espeja al upsert real: la rama update solo toca los campos provistos, así
      // que un campo omitido (por ejemplo `paypal_subscription_id`) sobrevive.
      current = current
        ? ({ ...current, ...data, store_id: storeId } as ISubscriptionEntity)
        : makeEntity({ store_id: storeId, ...data })
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
function fakeEventRepo(
  created: Array<NewSubscriptionEvent>,
  preExisting: NewSubscriptionEvent[] = [],
) {
  const keyOf = (d: NewSubscriptionEvent) =>
    [d.store_id, d.action, d.paypal_subscription_id ?? "", d.period_start?.getTime() ?? "null"].join("|")
  const keys = new Set(preExisting.map(keyOf))
  return {
    async create(data: NewSubscriptionEvent) {
      created.push(data)
    },
    async createIdempotent(data: NewSubscriptionEvent) {
      const key = keyOf(data)
      if (keys.has(key)) return null
      keys.add(key)
      created.push(data)
      return {
        id: `ev-${created.length}`,
        store_id: data.store_id,
        user_id: data.user_id,
        action: data.action,
        paypal_subscription_id: data.paypal_subscription_id ?? null,
        metadata: (data.metadata ?? null) as never,
        period_start: data.period_start ?? null,
        created_at: data.created_at ?? new Date(),
      }
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
      // Sin fila previa, checkout crea la fila en pending: el webhook la busca
      // por paypal_subscription_id y la pasa a active cuando PayPal cobra.
      assert.equal(getCurrent()!.status, "pending")
    })

    it("con suscripción activa y vigente → 409 y no toca PayPal (no se cancela una sub pagada)", async () => {
      const create = mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const cancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({ status: "active", paypal_subscription_id: "I-PAYPAL-OLD" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.checkout("store-1", "https://ok", "https://cancel"),
        (err: unknown) => err instanceof ConflictError && err.statusCode === 409,
      )
      assert.equal(create.mock.callCount(), 0, "no crea una sub nueva")
      assert.equal(cancel.mock.callCount(), 0, "no cancela la sub vigente")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-OLD", "la fila no se toca")
    })

    it("con active pero período ya vencido (deriva) → permite re-suscribirse", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const cancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({
        status: "active",
        paypal_subscription_id: "I-PAYPAL-OLD",
        current_period_end: new Date(Date.now() - 30 * DAY_MS),
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-PAYPAL-NEW")
      assert.equal(cancel.mock.callCount(), 1, "la sub vieja se cancela aunque la fila diga active")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-NEW")
    })

    it("con past_due dentro de la gracia → permite re-suscribirse (viene a arreglar el pago)", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const cancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({
        status: "past_due",
        paypal_subscription_id: "I-PAYPAL-OLD",
        current_period_end: new Date(Date.now() - 1 * DAY_MS),
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-PAYPAL-NEW")
      assert.equal(cancel.mock.callCount(), 1)
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-NEW")
    })

    it("al re-suscribirse cancela la sub vieja de PayPal antes de crear la nueva", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: "https://paypal.com/approve/new",
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const cancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({
        status: "expired",
        paypal_subscription_id: "I-PAYPAL-OLD",
        current_period_end: new Date(Date.now() - 30 * DAY_MS),
      })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-PAYPAL-NEW")
      assert.equal(cancel.mock.callCount(), 1)
      assert.equal(cancel.mock.calls[0].arguments[0], "I-PAYPAL-OLD")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-NEW")
      // Audita el reemplazo: sin esto la sub vieja queda sin rastro.
      const cancelAudit = created.find((e) => e.action === "cancel")
      assert.ok(cancelAudit, "audita la cancelación de la sub reemplazada")
      assert.equal(cancelAudit!.paypal_subscription_id, "I-PAYPAL-OLD")
      assert.deepEqual(cancelAudit!.metadata, {
        ip: null,
        userAgent: null,
        reason: "replaced_by_new_checkout",
      })
    })

    it("si cancelar la sub vieja falla → checkout rechaza y no crea la sub nueva", async () => {
      const create = mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      mock.method(paypalClient, "cancelSubscription", async () => {
        throw new AppError("PayPal no responde", 502, "PAYPAL_UPSTREAM_ERROR")
      })
      const existing = makeEntity({ status: "expired", paypal_subscription_id: "I-PAYPAL-OLD" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.checkout("store-1", "https://ok", "https://cancel"),
        (err: unknown) => err instanceof AppError && err.statusCode === 502,
      )
      assert.equal(create.mock.callCount(), 0, "no queda una sub nueva huérfana en PayPal")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-OLD", "la fila no se toca")
    })

    it("si la sub vieja ya estaba cancelada en PayPal (404) → checkout sigue", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      mock.method(paypalClient, "cancelSubscription", async () => {
        throw new AppError("Resource not found", 404, "PAYMENT_PROVIDER_REJECTED")
      })
      const existing = makeEntity({ status: "expired", paypal_subscription_id: "I-PAYPAL-OLD" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-PAYPAL-NEW")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-NEW")
    })

    it("si PayPal falla al crear la sub → checkout rechaza y no crea fila", async () => {
      mock.method(paypalClient, "createSubscription", async () => {
        throw new Error("paypal down")
      })
      const { repo, getCurrent } = makeRepo()
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.checkout("store-1", "https://ok", "https://cancel"))
      assert.equal(getCurrent(), null)
    })

    it("checkout sin actor → audita user_id null (noopActor)", async () => {
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-9",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const { repo } = makeRepo()
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(created.length, 1)
      assert.equal(created[0].action, "checkout")
      assert.equal(created[0].user_id, null)
      assert.deepEqual(created[0].metadata, { ip: null, userAgent: null })
    })
  })

  describe("activate", () => {
    it("activa la suscripción con período de 30 días", async () => {
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.activate("store-1", "I-PAYPAL-1")

      assert.equal(res.status, "active")
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

    it("registra el pago inicial como webhook_sale_completed (source=app_activate)", async () => {
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1" })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await service.activate("store-1", "I-PAYPAL-1", { userId: "user-1", ip: null, userAgent: null })

      const pay = created.find((e) => e.action === "webhook_sale_completed")
      assert.ok(pay, "debe registrar un cobro en subscription_events")
      assert.equal(pay.store_id, "store-1")
      assert.equal(pay.paypal_subscription_id, "I-PAYPAL-1")
      assert.ok(pay.period_start instanceof Date)
      const meta = pay.metadata as Record<string, unknown>
      assert.equal(meta.source, "app_activate")
      assert.equal(meta.event_id, undefined, "sin event_id → getBilling usa el fallback del precio del plan")
      assert.ok(typeof meta.period_start === "string" && meta.period_start.length > 0)
      assert.equal(pay.period_start.getTime(), getCurrent()!.current_period_start!.getTime())
    })

    it("doble click con período vigente → NO resetea el período ni registra un segundo pago", async () => {
      const now = new Date()
      const active = makeEntity({
        status: "active",
        paypal_subscription_id: "I-PAYPAL-1",
        current_period_start: now,
        current_period_end: new Date(now.getTime() + 20 * DAY_MS),
      })
      const { repo, getCurrent } = makeRepo(active)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      const res = await service.activate("store-1", "I-PAYPAL-1")

      assert.equal(res.status, "active")
      assert.equal(res.current_period_start, now.toISOString(), "el período original no se resetea")
      assert.equal(created.filter((e) => e.action === "webhook_sale_completed").length, 0)
      assert.equal(created.filter((e) => e.action === "activate").length, 1, "audita la activación una vez")
      assert.equal(getCurrent()!.current_period_start!.getTime(), now.getTime())
    })

    it("si el webhook ya registró el cobro → el insert idempotente no duplica", async () => {
      mock.timers.enable({ apis: ["Date"] })
      try {
        const fixedNow = new Date("2026-08-15T10:00:00Z")
        mock.timers.setTime(fixedNow.getTime())

        const webhookEvent: NewSubscriptionEvent = {
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { event_id: "wh-x", event_type: "PAYMENT.SALE.COMPLETED" },
          period_start: fixedNow,
        }
        const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1" })
        const { repo } = makeRepo(existing)
        const created: Array<NewSubscriptionEvent> = [webhookEvent]
        const service = createSubscriptionService(repo, fakeEventRepo(created, [webhookEvent]))

        await service.activate("store-1", "I-PAYPAL-1")

        const pays = created.filter((e) => e.action === "webhook_sale_completed")
        assert.equal(pays.length, 1, "el cobro del webhook no se duplica")
        assert.equal((pays[0].metadata as Record<string, unknown>)?.event_id, "wh-x")
      } finally {
        mock.timers.reset()
      }
    })

    it("lanza ConflictError si no hay fila local", async () => {
      const { repo } = makeRepo()
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.activate("store-1", "I-PAYPAL-1"),
        /no pertenece a esta tienda/,
      )
    })

    it("período vencido → renueva el período completo desde ahora", async () => {
      mock.timers.enable({ apis: ["Date"] })
      const fixedNow = new Date("2026-07-01T10:00:00Z")
      mock.timers.setTime(fixedNow.getTime())
      try {
        const expired = makeEntity({
          status: "active",
          paypal_subscription_id: "I-PAYPAL-1",
          current_period_start: new Date("2026-05-01T10:00:00Z"),
          current_period_end: new Date("2026-06-01T10:00:00Z"),
        })
        const { repo, getCurrent } = makeRepo(expired)
        const service = createSubscriptionService(repo)

        const res = await service.activate("store-1", "I-PAYPAL-1")

        assert.equal(res.status, "active")
        assert.equal(res.current_period_start, fixedNow.toISOString())
        assert.equal(getCurrent()!.current_period_start!.getTime(), fixedNow.getTime())
        assert.equal(getCurrent()!.current_period_end!.getTime(), fixedNow.getTime() + 30 * DAY_MS)
      } finally {
        mock.timers.reset()
      }
    })

    it("status active con período futuro → renueva el período desde ahora", async () => {
      const future = new Date(Date.now() + 10 * DAY_MS)
      const existing = makeEntity({
        status: "active",
        paypal_subscription_id: "I-PAYPAL-1",
        current_period_start: future,
        current_period_end: new Date(future.getTime() + 30 * DAY_MS),
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.activate("store-1", "I-PAYPAL-1")

      assert.equal(res.status, "active")
      assert.ok(getCurrent()!.current_period_start!.getTime() <= Date.now() + 1000)
    })

    it("update devuelve null → ConflictError (No hay suscripción activa)", async () => {
      const { repo } = makeRepo(makeEntity({ paypal_subscription_id: "I-PAYPAL-1" }))
      repo.update = async () => null
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.activate("store-1", "I-PAYPAL-1"), /No hay suscripción activa/)
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

    it("si PayPal falla al cancelar → no marca cancel_at_period_end", async () => {
      mock.method(paypalClient, "cancelSubscription", async () => {
        throw new Error("paypal down")
      })
      const existing = makeEntity({ paypal_subscription_id: "I-PAYPAL-1", status: "active" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.cancel("store-1"))
      assert.equal(getCurrent()!.status, "active")
      assert.equal(getCurrent()!.cancel_at_period_end, false)
    })

    it("sub sin paypal_subscription_id → ConflictError sin llamar a PayPal", async () => {
      const existing = makeEntity({ paypal_subscription_id: null, status: "active" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)
      const cancelSpy = mock.method(paypalClient, "cancelSubscription", async () => true)

      await assert.rejects(() => service.cancel("store-1"), /No hay suscripción activa/)
      assert.equal(cancelSpy.mock.callCount(), 0)
    })

    it("update devuelve null → ConflictError", async () => {
      mock.method(paypalClient, "cancelSubscription", async () => true)
      const { repo } = makeRepo(makeEntity({ paypal_subscription_id: "I-PAYPAL-1", status: "active" }))
      repo.update = async () => null
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.cancel("store-1"), /No hay suscripción activa/)
    })
  })

  describe("reactivate", () => {
    it("crea fila pending si no existía", async () => {
      const { repo, getCurrent } = makeRepo()
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "pending")
      assert.equal(getCurrent()!.status, "pending")
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

    it("reabre el flujo desde canceled SIN período vigente (queda pending para pagar de nuevo)", async () => {
      // Fuera del grace (3 días): sin período vigente no hay acceso que conservar y
      // corresponde reabrir el pago.
      const existing = makeEntity({
        status: "canceled",
        current_period_end: new Date(Date.now() - 10 * DAY_MS),
        paypal_subscription_id: "I-PAYPAL-1",
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "pending")
      assert.equal(getCurrent()!.status, "pending")
      assert.equal(getCurrent()!.cancel_at_period_end, false)
    })

    it("canceled CON período vigente → vuelve a active y conserva el acceso (no pending)", async () => {
      // Regresión: Whop reporta `canceled` en cuanto el cliente programa la cancelación,
      // aunque el período pagado siga vigente. Exigir `status === "active"` mandaba esos
      // casos al ramal de reapertura y los dejaba en `pending`, borrándole el mes pagado.
      const existing = makeEntity({
        status: "canceled",
        cancel_at_period_end: true,
        current_period_end: new Date(Date.now() + 20 * DAY_MS),
        paypal_subscription_id: "I-PAYPAL-1",
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(res.status, "active")
      assert.equal(res.cancel_at_period_end, false)
      assert.equal(getCurrent()!.status, "active")
      assert.equal(getCurrent()!.cancel_at_period_end, false)
    })
  })

  describe("auditoría", () => {
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

    it("con fila active pero período vencido → devuelve expired (regresión: la landing nunca veía 'Vencida')", async () => {
      const existing = makeEntity({
        status: "active",
        current_period_end: new Date("2026-09-11T12:00:00Z"),
      })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.getByStore("store-1")

      assert.equal(res.status, "expired")
      assert.equal(res.current_period_end, "2026-09-11T12:00:00.000Z", "el período pagado se sigue informando")
      assert.equal(res.days_overdue !== null && res.days_overdue > 0, true)
      assert.equal(res.grace_ends_at !== null, true)
    })

    it("active dentro de la gracia → sigue active, no expired", async () => {
      const existing = makeEntity({
        status: "active",
        current_period_end: new Date(Date.now() - 2 * 86_400_000),
      })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.getByStore("store-1")

      assert.equal(res.status, "active")
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
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
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

      // Período vigente: la fecha de pago siguiente es real, no una fecha ya pasada.
      const periodEnd = new Date("2099-09-01T12:00:00Z")
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
      assert.equal(res.next_payment_at, "2099-09-01T12:00:00.000Z")
      assert.equal(res.status, "active")
    })

    it("sub active con período ya vencido → next_payment_at null y status expired (regresión: fecha pasada como 'próxima')", async () => {
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return []
        },
        async count() {
          return 0
        },
      }
      // Caso reportado: cobró el 2026-08-12, el período terminó el 2026-09-11 y
      // la fila quedó 'active'. La API no debe anunciar otra fecha de pago.
      const { repo } = makeRepo(
        makeEntity({ status: "active", current_period_end: new Date("2026-09-11T12:00:00Z") }),
      )
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.next_payment_at, null)
      assert.equal(res.status, "expired")
      assert.equal(res.overdue_since, "2026-09-11T12:00:00.000Z", "el período vencido se informa para el copy")
      assert.equal(res.days_overdue !== null && res.days_overdue > 0, true)
    })

    it("sin cobros → payments vacío, total 0 y sin próxima fecha si no hay período", async () => {
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
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

    it("getBilling muestra el cobro de app_activate con el precio del plan (fallback 12.99 USD)", async () => {
      const paidAt = new Date("2026-08-15T10:00:00Z")
      const events = [
        {
          id: "ev-app",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { source: "app_activate", period_start: paidAt.toISOString() },
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return events
        },
        async count() {
          return 1
        },
      }
      const { repo } = makeRepo(makeEntity({ status: "active" }))
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "12.99")
      assert.equal(res.payments[0].currency, "USD")
      assert.equal(res.payments[0].paid_at, "2026-08-15T10:00:00.000Z")
      assert.equal(res.total_paid, "12.99")
      assert.equal(res.currency, "USD")
    })

    it("getBilling usa metadata.amount/currency del evento cuando están presentes", async () => {
      const paidAt = new Date("2026-08-15T10:00:00Z")
      const events = [
        {
          id: "ev-rec",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: {
            source: "reconciliation",
            transaction_id: "TX-9",
            amount: "19.49",
            currency: "EUR",
          },
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return events
        },
        async count() {
          return 1
        },
      }
      const { repo } = makeRepo(makeEntity({ status: "active" }))
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "19.49")
      assert.equal(res.payments[0].currency, "EUR")
      assert.equal(res.total_paid, "19.49")
      assert.equal(res.currency, "EUR")
    })

    it("outbox sin monto en el payload → cae al precio del plan fallback", async () => {
      const paidAt = new Date("2026-08-01T12:00:00Z")
      const events = [
        {
          id: "ev-1",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { event_id: "wh-1" },
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
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
          return [{ event_id: "wh-1", payload: {} }]
        },
      }
      const { repo } = makeRepo(
        makeEntity({ status: "active", current_period_end: new Date("2026-09-01T12:00:00Z") }),
      )
      const service = createSubscriptionService(repo, eventRepo, webhookRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "12.99")
      assert.equal(res.payments[0].currency, "USD")
    })

    it("event_id sin match en el outbox y sin metadata.amount → precio del plan", async () => {
      const paidAt = new Date("2026-08-01T12:00:00Z")
      const events = [
        {
          id: "ev-1",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { event_id: "wh-404" },
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
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
          return []
        },
      }
      const { repo } = makeRepo(
        makeEntity({ status: "active", current_period_end: new Date("2026-09-01T12:00:00Z") }),
      )
      const service = createSubscriptionService(repo, eventRepo, webhookRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "12.99")
      assert.equal(res.payments[0].currency, "USD")
    })

    it("metadata.amount sin metadata.currency → USD por defecto", async () => {
      const paidAt = new Date("2026-08-15T10:00:00Z")
      const events = [
        {
          id: "ev-1",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { source: "reconciliation", transaction_id: "TX-1", amount: "19.49" },
          period_start: null,
          created_at: paidAt,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return events
        },
        async count() {
          return 1
        },
      }
      const { repo } = makeRepo(makeEntity({ status: "active" }))
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 1)
      assert.equal(res.payments[0].amount, "19.49")
      assert.equal(res.payments[0].currency, "USD")
      assert.equal(res.currency, "USD")
    })

    it("sub cancelada con período seteado → next_payment_at null y currency USD", async () => {
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return []
        },
        async count() {
          return 0
        },
      }
      const { repo } = makeRepo(
        makeEntity({ status: "canceled", current_period_end: new Date("2026-09-01T12:00:00Z") }),
      )
      const service = createSubscriptionService(repo, eventRepo)

      const res = await service.getBilling("store-1")

      assert.deepEqual(res.payments, [])
      assert.equal(res.total_paid, "0.00")
      assert.equal(res.currency, "USD")
      assert.equal(res.next_payment_at, null)
    })

    it("suma el total de varios cobros y usa la moneda del primero", async () => {
      const paidAt = new Date("2026-08-01T12:00:00Z")
      const paidAt2 = new Date("2026-08-03T12:00:00Z")
      const events = [
        {
          id: "ev-1",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: { event_id: "wh-1" },
          period_start: null,
          created_at: paidAt,
        },
        {
          id: "ev-2",
          store_id: "store-1",
          user_id: null,
          action: "webhook_sale_completed",
          paypal_subscription_id: "I-PAYPAL-1",
          metadata: {
            source: "reconciliation",
            transaction_id: "TX-2",
            amount: "19.49",
            currency: "EUR",
          },
          period_start: null,
          created_at: paidAt2,
        },
      ]
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return events
        },
        async count() {
          return 2
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
      const { repo } = makeRepo(
        makeEntity({ status: "active", current_period_end: new Date("2099-09-01T12:00:00Z") }),
      )
      const service = createSubscriptionService(repo, eventRepo, webhookRepo)

      const res = await service.getBilling("store-1")

      assert.equal(res.payments.length, 2)
      assert.equal(res.payments[0].amount, "15.99")
      assert.equal(res.payments[0].currency, "USD")
      assert.equal(res.payments[1].amount, "19.49")
      assert.equal(res.payments[1].currency, "EUR")
      assert.equal(res.total_paid, "35.48")
      assert.equal(res.currency, "USD")
      assert.equal(res.next_payment_at, "2099-09-01T12:00:00.000Z")
    })

    // T36: la tarjeta de Facturación se vuelve a renderizar después de cancelar o
    // reactivar, y sin este campo no puede saber que la renovación ya no va.
    it("informa cancel_at_period_end de la fila guardada (T36)", async () => {
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return []
        },
        async count() {
          return 0
        },
      }
      const scheduled = makeRepo(
        makeEntity({ status: "active", cancel_at_period_end: true }),
      )
      const res = await createSubscriptionService(scheduled.repo, eventRepo).getBilling("store-1")

      assert.equal(res.cancel_at_period_end, true, "cancelada al fin del período")
      assert.equal(
        res.next_payment_at !== null,
        true,
        "el período sigue pago, así que la tarjeta muestra fecha y necesita el verbo 'cancela'",
      )

      const plain = makeRepo(makeEntity({ status: "active", cancel_at_period_end: false }))
      const res2 = await createSubscriptionService(plain.repo, eventRepo).getBilling("store-1")

      assert.equal(res2.cancel_at_period_end, false)
    })

    it("sin fila de suscripción → cancel_at_period_end false (T36)", async () => {
      const eventRepo = {
        async create() {},
        async createIdempotent() {
          return null
        },
        async findMany() {
          return []
        },
        async count() {
          return 0
        },
      }
      const { repo } = makeRepo()

      const res = await createSubscriptionService(repo, eventRepo).getBilling("store-1")

      assert.equal(res.cancel_at_period_end, false)
    })
  })

  describe("whop (S5)", () => {
    /** Membership como la devuelve `GET /memberships/{id}` ("la API decide"). */
    function liveMembership(overrides: Partial<WhopMembership> = {}): WhopMembership {
      const now = Date.now()
      return {
        id: "mem-1",
        status: "active",
        user: null,
        renewal_period_start: new Date(now - DAY_MS).toISOString(),
        renewal_period_end: new Date(now + 30 * DAY_MS).toISOString(),
        cancel_at_period_end: false,
        metadata: null,
        plan: null,
        product: null,
        ...overrides,
      }
    }

    it("cancel de una fila whop cancela en Whop y NO toca PayPal", async () => {
      const whopCancel = mock.method(whopClient, "cancelMembership", async () => {})
      const paypalCancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const existing = makeEntity({ provider: "whop", whop_membership_id: "mem-1", status: "active" })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.cancel("store-1")

      assert.equal(whopCancel.mock.callCount(), 1)
      assert.equal(whopCancel.mock.calls[0].arguments[0], "mem-1")
      assert.equal(paypalCancel.mock.callCount(), 0, "no debe tocar el cliente de PayPal")
      assert.equal(res.status, "active", "el cliente conserva el período que ya pagó")
      assert.equal(res.cancel_at_period_end, true)
      assert.equal(getCurrent()!.cancel_at_period_end, true)
    })

    it("cancel de una fila whop sin membership id → ConflictError sin llamar a la API", async () => {
      const whopCancel = mock.method(whopClient, "cancelMembership", async () => {})
      const existing = makeEntity({ provider: "whop", whop_membership_id: null, status: "active" })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(() => service.cancel("store-1"), /No hay suscripción activa/)
      assert.equal(whopCancel.mock.callCount(), 0)
    })

    it("reactivate de una fila whop reactiva en Whop antes de limpiar el flag", async () => {
      // La cancelación sigue viva en Whop: hay algo que revertir.
      mock.method(whopClient, "getMembership", async () =>
        liveMembership({ cancel_at_period_end: true }),
      )
      const whopReactivate = mock.method(whopClient, "reactivateMembership", async () => {})
      const existing = makeEntity({
        provider: "whop",
        whop_membership_id: "mem-1",
        status: "active",
        cancel_at_period_end: true,
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(whopReactivate.mock.callCount(), 1)
      assert.equal(whopReactivate.mock.calls[0].arguments[0], "mem-1")
      assert.equal(res.status, "active")
      assert.equal(getCurrent()!.cancel_at_period_end, false)
    })

    it("reactivate de una fila whop consulta la membership real antes de revertir", async () => {
      const getMembership = mock.method(whopClient, "getMembership", async () =>
        liveMembership({ cancel_at_period_end: true }),
      )
      const whopReactivate = mock.method(whopClient, "reactivateMembership", async () => {})
      const existing = makeEntity({
        provider: "whop",
        whop_membership_id: "mem-9",
        status: "active",
        cancel_at_period_end: true,
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.reactivate("store-1")

      assert.equal(getMembership.mock.callCount(), 1)
      assert.equal(getMembership.mock.calls[0].arguments[0], "mem-9")
      assert.equal(whopReactivate.mock.callCount(), 1)
      assert.equal(whopReactivate.mock.calls[0].arguments[0], "mem-9")
      assert.equal(res.status, "active")
      assert.equal(getCurrent()!.cancel_at_period_end, false)
    })

    it("reactivate de una fila whop cuya cancelación YA se ejecutó → ConflictError sin revertir ni escribir", async () => {
      // Caso real del sandbox: la fila dice `cancel_at_period_end` pero Whop ya ejecutó
      // la cancelación (`canceled_at` seteado, `renewal_period_end` nulo). Llamar a
      // `/reactivate` ahí es un 4xx del proveedor que se veía como 502 opaco.
      mock.method(whopClient, "getMembership", async () =>
        liveMembership({
          status: "canceled",
          cancel_at_period_end: false,
          renewal_period_end: null,
        }),
      )
      const whopReactivate = mock.method(whopClient, "reactivateMembership", async () => {})
      const existing = makeEntity({
        provider: "whop",
        whop_membership_id: "mem-1",
        status: "active",
        cancel_at_period_end: true,
      })
      const { repo, getCurrent } = makeRepo(existing)
      const update = mock.method(repo, "update")
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      await assert.rejects(
        () => service.reactivate("store-1"),
        (err: unknown) => {
          assert.ok(err instanceof ConflictError, "tiene que ser un 409, no un 502")
          assert.match(err.message, /ya está cancelada en Whop/)
          assert.match(err.message, /suscribite de nuevo/)
          return true
        },
      )
      assert.equal(whopReactivate.mock.callCount(), 0, "no se pide revertir algo que ya no existe")
      assert.equal(update.mock.callCount(), 0, "sin éxito no se toca la fila")
      assert.equal(getCurrent()!.cancel_at_period_end, true, "la fila queda como estaba")
      assert.equal(created.length, 0, "sin éxito no se audita")
    })

    it("cancel de PayPal sigue llamando al cliente de PayPal (no-regresión S2)", async () => {
      const paypalCancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const whopCancel = mock.method(whopClient, "cancelMembership", async () => {})
      const existing = makeEntity({
        provider: "paypal",
        paypal_subscription_id: "I-PAYPAL-1",
        status: "active",
      })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await service.cancel("store-1")

      assert.equal(paypalCancel.mock.callCount(), 1)
      assert.equal(whopCancel.mock.callCount(), 0)
    })
  })

  describe("whopCheckoutIntent", () => {
    it("emite plan + referencia firmada y deja la fila pending de Whop sin borrar el PayPal viejo", async () => {
      mock.property(env, "WHOP_PLAN_ID_MONTHLY", "plan_whop_1")
      const existing = makeEntity({ provider: "paypal", paypal_subscription_id: "I-PAYPAL-OLD" })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(repo, fakeEventRepo(created))

      const res = await service.whopCheckoutIntent("store-1", {
        userId: "user-1",
        ip: null,
        userAgent: null,
      })

      assert.equal(res.planId, "plan_whop_1")
      assert.equal(res.provider, "whop")
      assert.equal(verifyCheckoutRef(res.ref), "store-1")
      assert.equal(getCurrent()!.status, "pending")
      assert.equal(getCurrent()!.provider, "whop")
      assert.equal(getCurrent()!.mode, "cloud")
      assert.equal(getCurrent()!.plan, "monthly")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-OLD", "el id viejo de PayPal sobrevive")
      assert.equal(created.length, 1)
      assert.equal(created[0].action, "checkout")
      assert.equal(created[0].user_id, "user-1")
      assert.equal((created[0].metadata as Record<string, unknown>).provider, "whop")
    })

    it("sin WHOP_PLAN_ID_MONTHLY → 422 WHOP_PLAN_NOT_CONFIGURED sin tocar la DB", async () => {
      mock.property(env, "WHOP_PLAN_ID_MONTHLY", "")
      const { repo, getCurrent } = makeRepo()
      const upsert = mock.method(repo, "upsertCloud", async () => makeEntity())
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.whopCheckoutIntent("store-1"),
        (err: unknown) =>
          err instanceof AppError &&
          err.statusCode === 422 &&
          (err as AppError).code === "WHOP_PLAN_NOT_CONFIGURED",
      )
      assert.equal(upsert.mock.callCount(), 0)
      assert.equal(getCurrent(), null)
    })

    it("con suscripción activa y vigente → 409 sin tocar la fila", async () => {
      mock.property(env, "WHOP_PLAN_ID_MONTHLY", "plan_whop_1")
      const existing = makeEntity({
        status: "active",
        provider: "paypal",
        paypal_subscription_id: "I-PAYPAL-1",
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.whopCheckoutIntent("store-1"),
        (err: unknown) => err instanceof ConflictError && err.statusCode === 409,
      )
      assert.equal(getCurrent()!.status, "active")
      assert.equal(getCurrent()!.provider, "paypal")
    })
  })

  // B2: un intent de Whop abandonado deja `provider: "whop"` sin membership. Si el
  // cliente termina pagando con PayPal, el checkout debe recuperar el provider o el
  // cancel queda enrutado a Whop y explota con ConflictError.
  describe("provider tras un intent de Whop abandonado (B2)", () => {
    it("el checkout de PayPal recupera provider y el cancel va a PayPal", async () => {
      mock.property(env, "WHOP_PLAN_ID_MONTHLY", "plan_whop_1")
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-PAYPAL-NEW",
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId: "P-PLAN-1",
      }))
      const paypalCancel = mock.method(paypalClient, "cancelSubscription", async () => true)
      const whopCancel = mock.method(whopClient, "cancelMembership", async () => {})

      const existing = makeEntity({
        provider: "whop",
        whop_membership_id: null,
        status: "pending",
        paypal_subscription_id: null,
      })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      // Repro: intent emitido y abandonado, después el cliente paga con PayPal.
      await service.whopCheckoutIntent("store-1")
      assert.equal(getCurrent()!.provider, "whop")

      await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(getCurrent()!.provider, "paypal")
      assert.equal(getCurrent()!.paypal_subscription_id, "I-PAYPAL-NEW")

      await service.cancel("store-1")

      assert.equal(paypalCancel.mock.callCount(), 1)
      assert.equal(whopCancel.mock.callCount(), 0)
    })
  })

  // Recuperación del doble cobro: cuando Whop no vuelve al landing y la fila queda
  // `pending`, el cliente puede reconciliar contra la API de Whop por el email del
  // dueño en vez de volver a pagar.
  describe("syncWhopMembership", () => {
    /** Membership como la devuelve el listado de Whop. */
    function makeWhopMembership(overrides: Partial<WhopMembership> = {}): WhopMembership {
      const now = Date.now()
      return {
        id: "mem-1",
        status: "active",
        user: { id: "whop-user-1", email: "dueno@cajora.com", username: "dueno" },
        renewal_period_start: new Date(now - DAY_MS).toISOString(),
        renewal_period_end: new Date(now + 30 * DAY_MS).toISOString(),
        cancel_at_period_end: false,
        metadata: null,
        plan: { id: "plan_1" },
        product: null,
        ...overrides,
      }
    }

    /** Email del dueño inyectado: los tests no tocan Prisma. */
    const ownerEmail =
      (email: string | null) =>
      async (): Promise<string | null> =>
        email

    it("vincula la membership cuando el email del dueño coincide (case-insensitive)", async () => {
      mock.property(env, "WHOP_ENABLED", true)
      const list = mock.method(whopClient, "listMemberships", async () => [makeWhopMembership()])
      const existing = makeEntity({ status: "pending", provider: "whop", whop_membership_id: null })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(
        repo,
        fakeEventRepo(created),
        undefined,
        ownerEmail("Dueno@Cajora.com"),
      )

      const res = await service.syncWhopMembership("store-1", {
        userId: "user-1",
        ip: null,
        userAgent: null,
      })

      assert.equal(list.mock.callCount(), 1)
      assert.equal(getCurrent()!.provider, "whop")
      assert.equal(getCurrent()!.whop_membership_id, "mem-1")
      assert.equal(getCurrent()!.whop_user_id, "whop-user-1")
      assert.equal(getCurrent()!.status, "active")
      assert.equal(res.status, "active")
      assert.equal(res.whop_membership_id, "mem-1")
      assert.equal(created.length, 1)
      assert.equal(created[0].action, SUBSCRIPTION_EVENT_ACTIONS.WEBHOOK_WHOP_ACTIVATED)
      assert.equal(created[0].user_id, "user-1")
      assert.equal((created[0].metadata as Record<string, unknown>).source, "manual_sync")
      assert.equal((created[0].metadata as Record<string, unknown>).whop_status, "active")
    })

    it("NO vincula cuando el email no coincide con el del dueño", async () => {
      mock.property(env, "WHOP_ENABLED", true)
      mock.method(whopClient, "listMemberships", async () => [
        makeWhopMembership({ user: { id: "otro", email: "otro@example.com", username: "otro" } }),
      ])
      const existing = makeEntity({ status: "pending", provider: "whop", whop_membership_id: null })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(
        repo,
        fakeEventRepo(created),
        undefined,
        ownerEmail("dueno@cajora.com"),
      )

      const res = await service.syncWhopMembership("store-1")

      assert.equal(getCurrent()!.whop_membership_id, null)
      assert.equal(getCurrent()!.status, "pending")
      assert.equal(res.status, "pending")
      assert.equal(created.length, 0)
    })

    it("NO vincula cuando la membership no concede acceso (expired)", async () => {
      mock.property(env, "WHOP_ENABLED", true)
      mock.method(whopClient, "listMemberships", async () => [makeWhopMembership({ status: "expired" })])
      const existing = makeEntity({ status: "pending", provider: "whop", whop_membership_id: null })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(
        repo,
        fakeEventRepo(created),
        undefined,
        ownerEmail("dueno@cajora.com"),
      )

      const res = await service.syncWhopMembership("store-1")

      assert.equal(getCurrent()!.whop_membership_id, null)
      assert.equal(getCurrent()!.status, "pending")
      assert.equal(res.status, "pending")
      assert.equal(created.length, 0)
    })

    it("devuelve el estado actual sin cambios cuando no hay memberships", async () => {
      mock.property(env, "WHOP_ENABLED", true)
      mock.method(whopClient, "listMemberships", async () => [])
      const existing = makeEntity({ status: "pending", provider: "whop", whop_membership_id: null })
      const { repo, getCurrent } = makeRepo(existing)
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(
        repo,
        fakeEventRepo(created),
        undefined,
        ownerEmail("dueno@cajora.com"),
      )

      const res = await service.syncWhopMembership("store-1")

      assert.equal(getCurrent()!.status, "pending")
      assert.equal(getCurrent()!.whop_membership_id, null)
      assert.equal(res.status, "pending")
      assert.equal(res.whop_membership_id, null)
      assert.equal(created.length, 0)
    })

    it("con WHOP_ENABLED=false → ConflictError y la fila no se toca", async () => {
      mock.property(env, "WHOP_ENABLED", false)
      const list = mock.method(whopClient, "listMemberships", async () => [makeWhopMembership()])
      const existing = makeEntity({ status: "pending", provider: "whop", whop_membership_id: null })
      const { repo, getCurrent } = makeRepo(existing)
      const service = createSubscriptionService(
        repo,
        fakeEventRepo([]),
        undefined,
        ownerEmail("dueno@cajora.com"),
      )

      await assert.rejects(
        () => service.syncWhopMembership("store-1"),
        (err: unknown) => err instanceof ConflictError && err.statusCode === 409,
      )
      assert.equal(list.mock.callCount(), 0, "no debe consultar la API de Whop")
      assert.equal(getCurrent()!.status, "pending")
      assert.equal(getCurrent()!.whop_membership_id, null)
    })

    it("si la fila ya tiene esa membership, devuelve el estado actual sin reescribir", async () => {
      mock.property(env, "WHOP_ENABLED", true)
      mock.method(whopClient, "listMemberships", async () => [makeWhopMembership()])
      const existing = makeEntity({ status: "active", provider: "whop", whop_membership_id: "mem-1" })
      const { repo, getCurrent } = makeRepo(existing)
      const update = mock.method(repo, "update", async () => getCurrent())
      const created: Array<NewSubscriptionEvent> = []
      const service = createSubscriptionService(
        repo,
        fakeEventRepo(created),
        undefined,
        ownerEmail("dueno@cajora.com"),
      )

      const res = await service.syncWhopMembership("store-1")

      assert.equal(update.mock.callCount(), 0)
      assert.equal(getCurrent()!.whop_membership_id, "mem-1")
      assert.equal(res.whop_membership_id, "mem-1")
      assert.equal(created.length, 0)
    })
  })

  describe("checkout · guard de suscripción vigente", () => {
    it("canceled CON período vigente → rechaza el checkout (no se paga sin sumar tiempo)", async () => {
      // Regresión: el guard miraba `status === "active"`. Con una cancelación ya
      // programada el status es `canceled` aunque el período siga vigente, así que el
      // cliente podía pagar otra vez y no ganar ni un día: `buildMembershipUpdate` nunca
      // recorta el período ya pagado.
      const existing = makeEntity({
        status: "canceled",
        cancel_at_period_end: true,
        current_period_end: new Date(Date.now() + 20 * DAY_MS),
      })
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      await assert.rejects(
        () => service.checkout("store-1", "https://ok", "https://cancel"),
        (err: unknown) =>
          err instanceof ConflictError && /acceso vigente/.test((err as Error).message),
      )
    })

    it("canceled con período VENCIDO → permite volver a suscribirse", async () => {
      const existing = makeEntity({
        status: "canceled",
        current_period_end: new Date(Date.now() - 10 * DAY_MS),
      })
      mock.method(paypalClient, "createSubscription", async () => ({
        id: "I-NEW",
        approvalUrl: "https://approve",
        status: "APPROVAL_PENDING",
        planId: "P-1",
      }))
      const { repo } = makeRepo(existing)
      const service = createSubscriptionService(repo)

      const res = await service.checkout("store-1", "https://ok", "https://cancel")

      assert.equal(res.paypalSubscriptionId, "I-NEW")
    })
  })

})
