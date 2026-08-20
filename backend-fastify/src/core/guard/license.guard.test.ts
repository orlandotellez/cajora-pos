import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { env } from "@/config/env"
import { licenseGuard } from "./license.guard"
import { SubscriptionRepository } from "@/modules/subscriptions/infrastructure/subscription.prisma.repository"
import { PaymentRequiredError } from "@/core/errors/AppError"
import type { ISubscriptionEntity } from "@/modules/subscriptions/domain/subscription.entities"

const DAY_MS = 86_400_000

function makeSub(overrides: Partial<ISubscriptionEntity> = {}): ISubscriptionEntity {
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "pending",
    paypal_subscription_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeRequest(storeId: string): { cookies: Record<string, string>; headers: Record<string, string> } {
  const token = jwt.sign(
    { userId: "user-1", role: "admin", storeId, storeName: "Tienda" },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  )
  return { cookies: {}, headers: { authorization: `Bearer ${token}` } }
}

describe("licenseGuard", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("self_hosted → no gatea, aunque la tienda no tenga suscripción", async () => {
    mock.property(env, "APP_MODE", "self_hosted")
    mock.method(SubscriptionRepository, "getByStoreId", async () => null)

    await assert.doesNotReject(() => licenseGuard(makeRequest("store-1") as never, {} as never))
  })

  it("cloud sin fila de suscripción → 402 PaymentRequiredError", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () => null)

    await assert.rejects(
      () => licenseGuard(makeRequest("store-1") as never, {} as never),
      (err: unknown) => err instanceof PaymentRequiredError && err.statusCode === 402,
    )
  })

  it("cloud active → pasa", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () => makeSub({ status: "active" }))

    await assert.doesNotReject(() => licenseGuard(makeRequest("store-1") as never, {} as never))
  })

  it("cloud pending (eligió Cloud pero no pagó) → 402", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () => makeSub({ status: "pending" }))

    await assert.rejects(
      () => licenseGuard(makeRequest("store-1") as never, {} as never),
      (err: unknown) =>
        err instanceof PaymentRequiredError &&
        err.statusCode === 402 &&
        /Elige tu plan para continuar/.test((err as Error).message),
    )
  })

  it("cloud expired sin current_period_end → 402 (hoyo cerrado)", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeSub({ status: "expired", current_period_end: null }),
    )

    await assert.rejects(
      () => licenseGuard(makeRequest("store-1") as never, {} as never),
      (err: unknown) => err instanceof PaymentRequiredError,
    )
  })

  it("cloud canceled con período pagado vigente → pasa (no se bloquea a quien ya pagó)", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeSub({
        status: "canceled",
        current_period_start: new Date(Date.now() - 10 * DAY_MS),
        current_period_end: new Date(Date.now() + 20 * DAY_MS),
      }),
    )

    await assert.doesNotReject(() => licenseGuard(makeRequest("store-1") as never, {} as never))
  })

  it("cloud canceled sin current_period_end → 402 (hoyo cerrado)", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeSub({ status: "canceled", current_period_end: null }),
    )

    await assert.rejects(
      () => licenseGuard(makeRequest("store-1") as never, {} as never),
      (err: unknown) => err instanceof PaymentRequiredError,
    )
  })

  it("cloud past_due dentro del grace (1 día tras fin de período) → pasa", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeSub({
        status: "past_due",
        current_period_start: new Date(Date.now() - 31 * DAY_MS),
        current_period_end: new Date(Date.now() - 1 * DAY_MS),
      }),
    )

    await assert.doesNotReject(() => licenseGuard(makeRequest("store-1") as never, {} as never))
  })

  it("cloud past_due vencido hace 10 días → 402", async () => {
    mock.property(env, "APP_MODE", "cloud")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeSub({
        status: "past_due",
        current_period_start: new Date(Date.now() - 41 * DAY_MS),
        current_period_end: new Date(Date.now() - 10 * DAY_MS),
      }),
    )

    await assert.rejects(
      () => licenseGuard(makeRequest("store-1") as never, {} as never),
      (err: unknown) => err instanceof PaymentRequiredError,
    )
  })

  it("sin storeId en el token (p.ej. usuario sin tienda) → pasa (authGuard/storeGuard lo manejan)", async () => {
    mock.property(env, "APP_MODE", "cloud")
    // No se debe consultar la DB: sin storeId no hay a quién consultar
    const getByStoreId = mock.method(SubscriptionRepository, "getByStoreId", async () => null)
    const request = makeRequest("")

    await assert.doesNotReject(() => licenseGuard(request as never, {} as never))
    assert.equal(getByStoreId.mock.callCount(), 0)
  })

  it("cookie refresh (userId sin storeId) + Bearer con storeId → gatea con el Bearer (regresión: bypass en web)", async () => {
    mock.property(env, "APP_MODE", "cloud")
    const getByStoreId = mock.method(SubscriptionRepository, "getByStoreId", async () => null)
    // El navegador web tiene la cookie refreshToken (7 días, sin storeId) y el
    // frontend manda el accessToken por Bearer (con storeId). Antes, la cookie
    // ganaba la precedencia → storeId null → el guard se saltaba y una tienda
    // pending podía usar la app sin pagar.
    const refreshToken = jwt.sign({ userId: "user-1" }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" })
    const accessToken = jwt.sign(
      { userId: "user-1", role: "admin", storeId: "store-1", storeName: "Tienda" },
      env.JWT_SECRET,
      { expiresIn: "1h" },
    )
    const request = { cookies: { refreshToken }, headers: { authorization: `Bearer ${accessToken}` } }

    await assert.rejects(
      () => licenseGuard(request as never, {} as never),
      (err: unknown) => err instanceof PaymentRequiredError && err.statusCode === 402,
    )
    assert.equal(getByStoreId.mock.callCount(), 1)
  })
})
