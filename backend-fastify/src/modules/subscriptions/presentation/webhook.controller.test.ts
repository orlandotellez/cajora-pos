import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { Prisma } from "@prisma/client"
import { env } from "@/config/env"
import { webhookController } from "./webhook.controller"
import { SubscriptionRepository } from "../infrastructure/subscription.prisma.repository"
import { PayPalWebhookEventRepository } from "../infrastructure/paypal-webhook-event.prisma.repository"
import type { paypal_webhook_event } from "@prisma/client"

const WEBHOOK_ID = "test-webhook-id-123"
const CERT_URL = "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123"

/** Mockea fetch global: OAuth2 + el endpoint verify-webhook-signature de PayPal. */
function mockPayPalVerify(status: "SUCCESS" | "FAILURE") {
  return mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    if (url.includes("/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: status }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    return new Response("{}", { status: 404 })
  })
}

function buildRequest(rawBody: string) {
  return {
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": CERT_URL,
      "paypal-transmission-id": "txn-1",
      "paypal-transmission-time": "2026-08-13T12:00:00Z",
      "paypal-transmission-sig": "sig-falsa",
    },
    body: rawBody,
    log: { warn: () => {}, info: () => {}, error: () => {} },
  }
}

function buildReply() {
  const state: { status: number; body: unknown } = { status: 0, body: null }
  const reply = {
    status(code: number) {
      state.status = code
      return reply
    },
    send(body: unknown) {
      state.body = body
      return reply
    },
  }
  return { reply, state }
}

function makeOutbox(overrides: Partial<paypal_webhook_event> = {}): paypal_webhook_event {
  return {
    id: "outbox-1",
    event_id: "evt-1",
    event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
    resource_type: "subscription",
    resource_id: "I-PAYPAL-1",
    received_at: new Date(),
    processed_at: null,
    notes: null,
    payload: {},
    ...overrides,
  } as paypal_webhook_event
}

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  })
}

describe("webhookController.receive", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("evento duplicado (mismo event_id) → ACK 200 sin reprocesar", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")

    const rawBody = JSON.stringify({ id: "evt-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-PAYPAL-1" } })

    // Primer insert OK, segundo lanza P2002 (constraint UNIQUE event_id)
    let insertCalls = 0
    mock.method(PayPalWebhookEventRepository, "insert", async () => {
      insertCalls++
      if (insertCalls === 1) return makeOutbox()
      throw makeP2002()
    })
    const markProcessed = mock.method(PayPalWebhookEventRepository, "markProcessed", async () => {})

    // Dispatch: matchea una sub local para que el side effect se ejecute
    mock.method(SubscriptionRepository, "getByPaypalSubscriptionId", async () => ({
      id: "sub-1",
      store_id: "store-1",
      mode: "cloud",
      plan: "monthly",
      status: "trial",
      paypal_subscription_id: "I-PAYPAL-1",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      trial_ends_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }))
    const update = mock.method(SubscriptionRepository, "update", async (_storeId: string, _data: unknown) => null)

    // Primera entrega → procesa
    const r1 = buildRequest(rawBody)
    const rep1 = buildReply()
    await webhookController.receive(r1 as never, rep1.reply as never)
    assert.equal(rep1.state.status, 200)
    assert.equal(update.mock.callCount(), 1)

    // Reintento de PayPal con el MISMO event_id → ACK sin reprocesar
    const r2 = buildRequest(rawBody)
    const rep2 = buildReply()
    await webhookController.receive(r2 as never, rep2.reply as never)
    assert.equal(rep2.state.status, 200)
    assert.equal(update.mock.callCount(), 1, "el duplicado no debe reprocesar el dispatch")
  })

  it("BILLING.SUBSCRIPTION.ACTIVATED → marca la sub active", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")
    const rawBody = JSON.stringify({
      id: "evt-2",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource_type: "subscription",
      resource: { id: "I-PAYPAL-2", resource_type: "subscription" },
    })

    mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox({ event_id: "evt-2" }))
    mock.method(PayPalWebhookEventRepository, "markProcessed", async () => {})
    mock.method(SubscriptionRepository, "getByPaypalSubscriptionId", async () => ({
      id: "sub-1",
      store_id: "store-1",
      mode: "cloud",
      plan: "monthly",
      status: "trial",
      paypal_subscription_id: "I-PAYPAL-2",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      trial_ends_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }))
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as { status?: string; current_period_start?: Date }
    assert.equal(data.status, "active")
    assert.ok(data.current_period_start instanceof Date)
  })

  it("ACTIVATED sin SALE.COMPLETED → deja el período COMPLETO (start + end ~30 días)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")
    const rawBody = JSON.stringify({
      id: "evt-2b",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource_type: "subscription",
      resource: { id: "I-PAYPAL-2B", resource_type: "subscription" },
    })

    mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox({ event_id: "evt-2b" }))
    mock.method(PayPalWebhookEventRepository, "markProcessed", async () => {})
    mock.method(SubscriptionRepository, "getByPaypalSubscriptionId", async () => ({
      id: "sub-1",
      store_id: "store-1",
      mode: "cloud",
      plan: "monthly",
      status: "trial",
      paypal_subscription_id: "I-PAYPAL-2B",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      trial_ends_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }))
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as {
      status?: string
      current_period_start?: Date
      current_period_end?: Date
    }
    assert.equal(data.status, "active")
    const start = (data.current_period_start as Date).getTime()
    const end = (data.current_period_end as Date).getTime()
    assert.ok(end - start >= 29 * 86_400_000 && end - start <= 30 * 86_400_000, "período completo ~30 días")
  })

  it("ACTIVATED con período ya seteado (SALE llegó antes) → NO pisa current_period_end", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")
    const existingEnd = new Date(Date.now() + 25 * 86_400_000)
    const rawBody = JSON.stringify({
      id: "evt-2c",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource_type: "subscription",
      resource: { id: "I-PAYPAL-2C", resource_type: "subscription" },
    })

    mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox({ event_id: "evt-2c" }))
    mock.method(PayPalWebhookEventRepository, "markProcessed", async () => {})
    mock.method(SubscriptionRepository, "getByPaypalSubscriptionId", async () => ({
      id: "sub-1",
      store_id: "store-1",
      mode: "cloud",
      plan: "monthly",
      status: "trial",
      paypal_subscription_id: "I-PAYPAL-2C",
      current_period_start: null,
      current_period_end: existingEnd,
      cancel_at_period_end: false,
      trial_ends_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }))
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as { current_period_end?: Date }
    assert.equal(data.current_period_end, undefined, "no debe pisar un período ya vigente")
  })

  it("PAYMENT.SALE.COMPLETED (renovación) → extiende +30 días usando billing_agreement_id", async () => {    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")
    // En PAYMENT.SALE.* el resource.id es el del SALE; la sub va en billing_agreement_id (fix T1.7.6)
    const rawBody = JSON.stringify({
      id: "evt-3",
      event_type: "PAYMENT.SALE.COMPLETED",
      resource_type: "sale",
      resource: {
        id: "SALE-XXX",
        billing_agreement_id: "I-PAYPAL-3",
        resource_type: "sale",
      },
    })

    mock.method(PayPalWebhookEventRepository, "insert", async () =>
      makeOutbox({ event_id: "evt-3", event_type: "PAYMENT.SALE.COMPLETED", resource_id: "I-PAYPAL-3" }),
    )
    mock.method(PayPalWebhookEventRepository, "markProcessed", async () => {})
    // La sub se busca por el id de SUSCRIPCIÓN (I-PAYPAL-3), NO por el id del sale
    const getByPaypal = mock.method(SubscriptionRepository, "getByPaypalSubscriptionId", async (id: string) => {
      assert.equal(id, "I-PAYPAL-3")
      return {
        id: "sub-1",
        store_id: "store-1",
        mode: "cloud",
        plan: "monthly",
        status: "active",
        paypal_subscription_id: "I-PAYPAL-3",
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    })
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    assert.equal(getByPaypal.mock.callCount(), 1)
    const data = update.mock.calls[0].arguments[1] as {
      status?: string
      current_period_start?: Date
      current_period_end?: Date
      cancel_at_period_end?: boolean
    }
    assert.equal(data.status, "active")
    assert.equal(data.cancel_at_period_end, false)
    const start = data.current_period_start!.getTime()
    const end = data.current_period_end!.getTime()
    assert.ok(end - start >= 29 * 86_400_000 && end - start <= 30 * 86_400_000, "período extendido ~30 días")
  })

  it("firma inválida (PayPal FAILURE) → ACK 200 y NO procesa (no inserta, no dispatch)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("FAILURE")
    const rawBody = JSON.stringify({ id: "evt-malo", event_type: "BILLING.SUBSCRIPTION.ACTIVATED" })

    const insert = mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox())

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    assert.equal(insert.mock.callCount(), 0)
  })

  it("body no parseable → ACK 200 sin insertar (el verifier lo rechaza antes de parsear)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalVerify("SUCCESS")
    const rawBody = "no-json-{{{"

    const insert = mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox())

    const { reply, state } = buildReply()
    await webhookController.receive(buildRequest(rawBody) as never, reply as never)

    assert.equal(state.status, 200)
    assert.equal(insert.mock.callCount(), 0)
  })

  it("fallo de red al verificar con PayPal → error (500 → PayPal reintenta), sin procesar", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("network down")
    })
    const rawBody = JSON.stringify({ id: "evt-x", event_type: "BILLING.SUBSCRIPTION.ACTIVATED" })

    const insert = mock.method(PayPalWebhookEventRepository, "insert", async () => makeOutbox())

    const { reply } = buildReply()
    await assert.rejects(() => webhookController.receive(buildRequest(rawBody) as never, reply as never))
    assert.equal(insert.mock.callCount(), 0)
  })
})
