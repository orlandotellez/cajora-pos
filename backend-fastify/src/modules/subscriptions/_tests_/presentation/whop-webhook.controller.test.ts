import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { makeP2002 } from "@/tests/fakes"
import { whopWebhookController } from "../../presentation/whop-webhook.controller"
import { SubscriptionRepository } from "../../infrastructure/subscription.prisma.repository"
import { WhopWebhookEventRepository } from "../../infrastructure/whop-webhook-event.prisma.repository"
import { SubscriptionEventRepository } from "../../infrastructure/subscription-event.prisma.repository"
import { whopClient } from "../../infrastructure/whop.client"
import { AppError } from "@/core/errors/AppError"
import type { whop_webhook_event } from "@/generated/prisma/client"

const MEMBERSHIP_ID = "mem-1"
const DAY_MS = 86_400_000

/** Fecha ISO desplazada `days` días desde ahora (para armar períodos de Whop). */
function isoFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

/**
 * El verifier real se desactiva por env (`WHOP_ENABLED=false`) salvo en el test de
 * firma inválida: así el resto de los casos ejercita el controller sin firmar payloads.
 */
function buildRequest(rawBody: string, headers: Record<string, string> = {}) {
  return {
    headers: {
      "webhook-id": "whop-evt-1",
      "webhook-timestamp": "1000",
      ...headers,
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

/** Membership tal como la devuelve la API de Whop (la verdad la decide el GET). */
function makeMembership(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MEMBERSHIP_ID,
    status: "active",
    user: { id: "whop-user-1", email: "a@b.c", username: "u" },
    renewal_period_start: isoFromNow(0),
    renewal_period_end: isoFromNow(30),
    cancel_at_period_end: false,
    metadata: null,
    plan: null,
    product: null,
    ...overrides,
  }
}

function makeOutbox(overrides: Partial<whop_webhook_event> = {}): whop_webhook_event {
  return {
    id: "outbox-1",
    event_id: "evt-1",
    event_type: "membership.activated",
    resource_id: MEMBERSHIP_ID,
    received_at: new Date(),
    processed_at: null,
    notes: null,
    payload: {},
    ...overrides,
  } as whop_webhook_event
}

/** Fila local vinculada a la membership (la crea el checkout de T4). */
function makeLocalSub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub-1",
    store_id: "store-1",
    mode: "cloud",
    plan: "monthly",
    status: "pending",
    provider: "whop",
    paypal_subscription_id: null,
    whop_membership_id: MEMBERSHIP_ID,
    whop_user_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

/** Arma el body estándar de Whop: `{ id, type, data }`. */
function body(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({ id: `evt-${type}`, type, data })
}

describe("whopWebhookController.receive", () => {
  beforeEach(() => {
    mock.restoreAll()
    // Auditoría a DB real: se mockea en cada test que la ejercita.
    mock.method(SubscriptionEventRepository, "create", async () => {})
    // El insert real devuelve la fila persistida (con el payload); el mock lo imita
    // para que el dispatch lea el mismo envelope que Whop envió.
    mock.method(WhopWebhookEventRepository, "insert", async (data: Record<string, unknown>) =>
      makeOutbox({
        event_id: data.event_id as string,
        event_type: data.event_type as string,
        resource_id: data.resource_id as string | null,
        payload: data.payload as never,
      }),
    )
    mock.method(WhopWebhookEventRepository, "markProcessed", async () => {})
  })
  afterEach(() => mock.restoreAll())

  it("firma inválida → ACK 200 sin insertar en el outbox ni tocar la DB", async () => {
    mock.property(env, "WHOP_ENABLED", true)
    mock.property(env, "WHOP_WEBHOOK_SECRET", "ws_test")
    const insert = mock.method(WhopWebhookEventRepository, "insert", async () => makeOutbox())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(insert.mock.callCount(), 0, "una firma inválida no debe escribir el outbox")
    assert.equal(update.mock.callCount(), 0)
  })

  it("evento duplicado (P2002) → ACK 200 sin volver a despachar", async () => {
    const getMembership = mock.method(whopClient, "getMembership", async () => makeMembership())
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    let insertCalls = 0
    mock.method(WhopWebhookEventRepository, "insert", async (data: Record<string, unknown>) => {
      insertCalls++
      if (insertCalls === 1) {
        return makeOutbox({
          event_id: data.event_id as string,
          event_type: data.event_type as string,
          resource_id: data.resource_id as string | null,
          payload: data.payload as never,
        })
      }
      throw makeP2002()
    })

    const raw = body("membership.activated", { id: MEMBERSHIP_ID })

    const r1 = buildReply()
    await whopWebhookController.receive(buildRequest(raw) as never, r1.reply as never)
    assert.equal(r1.state.status, 200)
    assert.equal(update.mock.callCount(), 1)

    const r2 = buildReply()
    await whopWebhookController.receive(buildRequest(raw) as never, r2.reply as never)
    assert.equal(r2.state.status, 200)
    assert.equal(update.mock.callCount(), 1, "el duplicado no debe reprocesar el dispatch")
    assert.equal(getMembership.mock.callCount(), 1, "el duplicado no debe consultar la API")
  })

  it("membership.activated → fila active con el período REAL de Whop", async () => {
    const start = isoFromNow(0)
    const end = isoFromNow(30)
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ renewal_period_start: start, renewal_period_end: end }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audits: Array<{ action: string; paypal_subscription_id?: string | null; metadata?: Record<string, unknown> }> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      audits.push(data as never)
    })
    const markProcessed = mock.method(WhopWebhookEventRepository, "markProcessed", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as {
      status?: string
      current_period_start?: Date
      current_period_end?: Date
      cancel_at_period_end?: boolean
      whop_user_id?: string
      paypal_subscription_id?: string | null
    }
    assert.equal(data.status, "active")
    assert.equal(data.current_period_end?.getTime(), new Date(end).getTime())
    assert.equal(data.current_period_start?.getTime(), new Date(start).getTime())
    assert.equal(data.cancel_at_period_end, false)
    assert.equal(data.whop_user_id, "whop-user-1")
    assert.equal(data.paypal_subscription_id, undefined, "Whop no debe tocar la columna de PayPal")
    assert.equal(audits[0].action, "webhook_whop_activated")
    assert.equal(audits[0].paypal_subscription_id, null)
    assert.equal((audits[0].metadata as Record<string, unknown>).whop_status, "active")
    assert.equal(markProcessed.mock.callCount(), 1)
  })

  it("past_due → fila past_due (sin flag de cancelación)", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ status: "past_due", renewal_period_end: null, renewal_period_start: null }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audits: Array<{ action?: string }> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      audits.push(data as never)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.past_due", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as { status?: string; cancel_at_period_end?: boolean }
    assert.equal(data.status, "past_due")
    assert.equal(data.cancel_at_period_end, false)
    assert.equal(audits[0].action, "webhook_whop_past_due")
  })

  it("canceled → fila canceled + cancel_at_period_end true", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ status: "canceled", renewal_period_end: null, renewal_period_start: null }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audits: Array<{ action?: string }> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      audits.push(data as never)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.canceled", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as { status?: string; cancel_at_period_end?: boolean }
    assert.equal(data.status, "canceled")
    assert.equal(data.cancel_at_period_end, true)
    assert.equal(audits[0].action, "webhook_whop_canceled")
  })

  it("active con cancelación programada → sigue active y conserva el flag", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ status: "active", cancel_at_period_end: true }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.updated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const data = update.mock.calls[0].arguments[1] as { status?: string; cancel_at_period_end?: boolean }
    assert.equal(data.status, "active")
    assert.equal(data.cancel_at_period_end, true)
  })

  it("membership 404 en la API → ACK 200 sin tocar la DB (huérfana)", async () => {
    mock.method(whopClient, "getMembership", async () => {
      throw new AppError("El recurso solicitado no existe en Whop", 404, "WHOP_NOT_FOUND")
    })
    const getLocal = mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audit = mock.method(SubscriptionEventRepository, "create", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(getLocal.mock.callCount(), 0)
    assert.equal(update.mock.callCount(), 0)
    assert.equal(audit.mock.callCount(), 0)
  })

  it("membership sin fila local → ACK 200 sin escribir (el vínculo lo crea el checkout)", async () => {
    mock.method(whopClient, "getMembership", async () => makeMembership())
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audit = mock.method(SubscriptionEventRepository, "create", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(update.mock.callCount(), 0)
    assert.equal(audit.mock.callCount(), 0)
  })

  it("payload sin id de membership → ACK 200 sin consultar la API ni escribir", async () => {
    const getMembership = mock.method(whopClient, "getMembership", async () => makeMembership())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.updated", {})) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(getMembership.mock.callCount(), 0)
    assert.equal(update.mock.callCount(), 0)
  })

  it("error de red al leer la membership → 500 y el outbox queda SIN procesar (Whop reintenta)", async () => {
    mock.method(whopClient, "getMembership", async () => {
      throw new AppError("No se pudo conectar con Whop", 502, "WHOP_NETWORK_ERROR")
    })
    const markProcessed = mock.method(WhopWebhookEventRepository, "markProcessed", async () => {})
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 500)
    assert.equal(markProcessed.mock.callCount(), 0, "sin marcar procesado para que Whop reintente")
    assert.equal(update.mock.callCount(), 0)
  })

  it("payment.failed resuelve la membership desde data.membership_id", async () => {
    const getMembership = mock.method(whopClient, "getMembership", async (id: string) => {
      assert.equal(id, MEMBERSHIP_ID)
      return makeMembership()
    })
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(
        body("payment.failed", { id: "pay-1", membership_id: MEMBERSHIP_ID }),
      ) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(getMembership.mock.callCount(), 1)
    assert.equal(update.mock.callCount(), 1)
  })
})
