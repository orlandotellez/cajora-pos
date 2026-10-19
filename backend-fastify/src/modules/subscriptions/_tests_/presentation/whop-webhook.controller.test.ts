import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { makeP2002 } from "@/tests/fakes"
import { whopWebhookController } from "../../presentation/whop-webhook.controller"
import { SubscriptionRepository } from "../../infrastructure/subscription.prisma.repository"
import { WhopWebhookEventRepository } from "../../infrastructure/whop-webhook-event.prisma.repository"
import { SubscriptionEventRepository } from "../../infrastructure/subscription-event.prisma.repository"
import { whopClient } from "../../infrastructure/whop.client"
import { OwnerLookup } from "../../infrastructure/owner-lookup"
import { createCheckoutRef } from "../../domain/whop-checkout-ref"
import { AppError } from "@/core/errors/AppError"
import type { whop_webhook_event } from "@/generated/prisma/client"

const MEMBERSHIP_ID = "mem-1"
const DAY_MS = 86_400_000

/** Fecha ISO desplazada `days` días desde ahora (para armar períodos de Whop). */
function isoFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

/**
 * El verificador real se desactiva en el `beforeEach` (`WHOP_ENABLED=false`) salvo en el
 * test de firma inválida: así el resto de los casos ejercita el controller sin firmar
 * payloads, y el resultado no cambia según cómo esté el `.env` del entorno.
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
  // Valor real del entorno, para restaurarlo al final: los tests NO deben depender del
  // `.env`. Con `WHOP_ENABLED=true` (el valor de producción) el controller rechazaría
  // estos payloads sin firma y los casos fallarían por una razón ajena a lo que prueban.
  const originalWhopEnabled = env.WHOP_ENABLED

  beforeEach(() => {
    mock.restoreAll()
    // Asignación directa y NO `mock.property`: el test de firma inválida vuelve a mockear
    // esta misma propiedad, y node:test falla al restaurar dos mocks anidados sobre la
    // misma clave ("'value' present on property with getter or setter").
    env.WHOP_ENABLED = false
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
    // Por defecto el outbox ya tiene la fila procesada: un P2002 se trata como
    // duplicado. El test de reintento lo sobreescribe con una fila pendiente.
    mock.method(WhopWebhookEventRepository, "findByEventId", async () =>
      makeOutbox({ processed_at: new Date() }),
    )
    // El fallback por email de T21: por defecto no matchea ninguna tienda. Los casos
    // del fallback lo sobreescriben; el resto de los tests prueban que sin ref y sin
    // match no se escribe nada.
    mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async () => null)
  })
  afterEach(() => {
    env.WHOP_ENABLED = originalWhopEnabled
    mock.restoreAll()
  })

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

  it("primera compra con metadata.ref válido → vincula la tienda y activa la fila", async () => {
    const ref = createCheckoutRef("store-1")
    mock.method(whopClient, "getMembership", async () => makeMembership({ metadata: { ref } }))
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    // Fila pendiente creada por el intent: todavía sin membership id y con un PayPal viejo.
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeLocalSub({ provider: "whop", whop_membership_id: null, paypal_subscription_id: "I-PAYPAL-OLD" }),
    )
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audits: Array<{ action?: string }> = []
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
    assert.equal(update.mock.calls[0].arguments[0], "store-1")
    const data = update.mock.calls[0].arguments[1] as {
      provider?: string
      whop_membership_id?: string
      status?: string
      paypal_subscription_id?: string | null
    }
    assert.equal(data.provider, "whop")
    assert.equal(data.whop_membership_id, MEMBERSHIP_ID)
    assert.equal(data.status, "active")
    assert.equal(data.paypal_subscription_id, undefined, "el id viejo de PayPal no se borra")
    assert.equal(audits[0].action, "webhook_whop_activated")
    assert.equal(markProcessed.mock.callCount(), 1)
  })

  it("primera compra con ref adulterada → ACK 200 sin tocar la DB", async () => {
    const ref = `${createCheckoutRef("store-1")}x`
    mock.method(whopClient, "getMembership", async () => makeMembership({ metadata: { ref } }))
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const byStore = mock.method(SubscriptionRepository, "getByStoreId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(byStore.mock.callCount(), 0, "una ref inválida no resuelve tienda")
    assert.equal(update.mock.callCount(), 0)
  })

  it("primera compra sin ref → ACK 200 sin tocar la DB", async () => {
    mock.method(whopClient, "getMembership", async () => makeMembership({ metadata: null }))
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const byStore = mock.method(SubscriptionRepository, "getByStoreId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(byStore.mock.callCount(), 0)
    assert.equal(update.mock.callCount(), 0)
  })

  it("un dispatch fallido se recupera en el reintento con el MISMO webhook-id (B3)", async () => {
    let stored: whop_webhook_event | null = null
    mock.method(WhopWebhookEventRepository, "insert", async (data: Record<string, unknown>) => {
      if (stored) throw makeP2002()
      stored = makeOutbox({
        event_id: data.event_id as string,
        event_type: data.event_type as string,
        resource_id: data.resource_id as string | null,
        payload: data.payload as never,
      })
      return stored
    })
    mock.method(WhopWebhookEventRepository, "findByEventId", async () => stored)
    const markProcessed = mock.method(WhopWebhookEventRepository, "markProcessed", async () => {})

    let calls = 0
    const getMembership = mock.method(whopClient, "getMembership", async () => {
      calls++
      if (calls === 1) throw new AppError("red caída", 502, "WHOP_NETWORK_ERROR")
      return makeMembership()
    })
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const raw = body("membership.activated", { id: MEMBERSHIP_ID })
    const headers = { "webhook-id": "whop-retry-1" }

    const r1 = buildReply()
    await whopWebhookController.receive(buildRequest(raw, headers) as never, r1.reply as never)
    assert.equal(r1.state.status, 500, "el primer intento falla y deja la fila sin procesar")
    assert.equal(markProcessed.mock.callCount(), 0)

    const r2 = buildReply()
    await whopWebhookController.receive(buildRequest(raw, headers) as never, r2.reply as never)
    assert.equal(r2.state.status, 200, "el reintento recupera")
    assert.equal(getMembership.mock.callCount(), 2, "el reintento vuelve a despachar")
    assert.equal(markProcessed.mock.callCount(), 1)
    assert.equal(update.mock.callCount(), 1)
  })

  it("primera compra sin ref con email del comprador que matchea dueño → vincula y activa la fila (T21)", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({
        metadata: null,
        user: { id: "whop-user-1", email: "duenio@cajora.com", username: "u" },
      }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const lookup = mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async (email: string) => {
      assert.equal(email, "duenio@cajora.com")
      return "store-1"
    })
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeLocalSub({ whop_membership_id: null, status: "pending" }),
    )
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audits: Array<{ action?: string; metadata?: Record<string, unknown> }> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      audits.push(data as never)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(lookup.mock.callCount(), 1)
    assert.equal(update.mock.calls[0].arguments[0], "store-1")
    const data = update.mock.calls[0].arguments[1] as {
      provider?: string
      whop_membership_id?: string
      whop_user_id?: string
      status?: string
    }
    assert.equal(data.provider, "whop")
    assert.equal(data.whop_membership_id, MEMBERSHIP_ID)
    assert.equal(data.whop_user_id, "whop-user-1")
    assert.equal(data.status, "active")
    assert.equal(audits[0].action, "webhook_whop_activated")
    assert.equal((audits[0].metadata as Record<string, unknown>).source, "webhook_email_link")
    assert.equal((audits[0].metadata as Record<string, unknown>).whop_status, "active")
  })

  it("primera compra sin ref con email sin dueño → nada escrito (T21)", async () => {
    mock.method(whopClient, "getMembership", async () => makeMembership({ metadata: null }))
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const lookup = mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async () => null)
    const byStore = mock.method(SubscriptionRepository, "getByStoreId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const audit = mock.method(SubscriptionEventRepository, "create", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(lookup.mock.callCount(), 1)
    assert.equal(byStore.mock.callCount(), 0, "un email sin dueño no resuelve tienda")
    assert.equal(update.mock.callCount(), 0)
    assert.equal(audit.mock.callCount(), 0)
  })

  it("primera compra sin ref y sin email del comprador → no consulta el fallback ni escribe (T21)", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ metadata: null, user: { id: "whop-user-1", email: null, username: "u" } }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    // El mock devolvería tienda si se lo consultara; el test prueba que no se lo llama.
    const lookup = mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async () => "store-1")
    const update = mock.method(SubscriptionRepository, "update", async () => null)

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(lookup.mock.callCount(), 0, "sin email no hay último recurso")
    assert.equal(update.mock.callCount(), 0)
  })

  it("orden de resolución: con metadata.ref válido NO se consulta el email del comprador (T21)", async () => {
    const ref = createCheckoutRef("store-1")
    mock.method(whopClient, "getMembership", async () => makeMembership({ metadata: { ref } }))
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    // Si el fallback por email se consultara, devolvería OTRA tienda y el test fallaría.
    const lookup = mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async () => "store-otra")
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeLocalSub({ whop_membership_id: null }),
    )
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    mock.method(SubscriptionEventRepository, "create", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(lookup.mock.callCount(), 0, "la referencia firmada nunca se saltea por email")
    assert.equal(update.mock.calls[0].arguments[0], "store-1")
  })

  it("el email del comprador sale del payload, no de la API (que no lo devuelve) (T21)", async () => {
    // `GET /memberships/{id}` NO incluye `user.email`: leerlo solo de ahí dejaba este
    // camino muerto. El payload del webhook sí lo trae, y viene firmado por Whop.
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ metadata: null, user: null }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => null)
    const lookup = mock.method(OwnerLookup, "findStoreIdByOwnerEmail", async (email: string) => {
      assert.equal(email, "duenio@cajora.com")
      return "store-1"
    })
    mock.method(SubscriptionRepository, "getByStoreId", async () =>
      makeLocalSub({ whop_membership_id: null, status: "pending" }),
    )
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    mock.method(SubscriptionEventRepository, "create", async () => {})

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(
        body("membership.activated", {
          id: MEMBERSHIP_ID,
          user: { id: "whop-user-1", email: "duenio@cajora.com", username: "u" },
        }),
      ) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(lookup.mock.callCount(), 1, "debe buscar por el email del payload")
    assert.equal(update.mock.callCount(), 1, "debe vincular la fila")
  })

  it("membership.activated con renewal_price → registra el cobro con el monto renovado (T33)", async () => {
    const start = isoFromNow(0)
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({
        renewal_period_start: start,
        initial_price: { currency: "usd", amount: "0.00", decimals: 2 },
        renewal_price: { currency: "usd", amount: "12.99", decimals: 2 },
      }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    mock.method(SubscriptionRepository, "update", async () => null)
    const events: Array<Record<string, unknown>> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      events.push(data)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const charge = events.find((e) => e.action === "webhook_sale_completed")
    assert.ok(charge, "membership.activated de acceso debe registrar el cobro")
    assert.equal(charge.store_id, "store-1")
    assert.equal(charge.user_id, null)
    assert.equal(charge.paypal_subscription_id, null)
    assert.equal((charge.period_start as Date).getTime(), new Date(start).getTime())
    const meta = charge.metadata as Record<string, unknown>
    assert.equal(meta.source, "whop_webhook")
    assert.equal(meta.amount, "12.99", "toma el renewal_price, no el initial_price")
    assert.equal(meta.currency, "usd")
    assert.equal(meta.whop_membership_id, MEMBERSHIP_ID)
  })

  it("membership.activated sin precios → registra el cobro igual y SIN amount en el metadata (T33)", async () => {
    mock.method(whopClient, "getMembership", async () => makeMembership())
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    mock.method(SubscriptionRepository, "update", async () => null)
    const events: Array<Record<string, unknown>> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      events.push(data)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    const charge = events.find((e) => e.action === "webhook_sale_completed")
    assert.ok(charge, "sin precios el cobro se registra igual")
    const meta = charge.metadata as Record<string, unknown>
    assert.equal("amount" in meta, false, "no se inventa un monto: getBilling cae al precio del plan")
    assert.equal("currency" in meta, false)
    assert.equal(meta.source, "whop_webhook")
  })

  it("membership.updated que concede acceso → NO registra cobro (T33)", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ renewal_price: { currency: "usd", amount: "12.99", decimals: 2 } }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const events: Array<Record<string, unknown>> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      events.push(data)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.updated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200)
    assert.equal(update.mock.callCount(), 1, "el update de acceso sí se aplica")
    assert.equal(
      events.some((e) => e.action === "webhook_sale_completed"),
      false,
      "solo membership.activated cobra",
    )
  })

  it("fallo al registrar el cobro → el webhook responde 200 y la fila igual se actualiza (T33)", async () => {
    mock.method(whopClient, "getMembership", async () =>
      makeMembership({ renewal_price: { currency: "usd", amount: "12.99", decimals: 2 } }),
    )
    mock.method(SubscriptionRepository, "getByWhopMembershipId", async () => makeLocalSub())
    const update = mock.method(SubscriptionRepository, "update", async () => null)
    const events: Array<Record<string, unknown>> = []
    mock.method(SubscriptionEventRepository, "create", async (data: Record<string, unknown>) => {
      if (data.action === "webhook_sale_completed") throw new Error("DB caída al registrar el cobro")
      events.push(data)
    })

    const { reply, state } = buildReply()
    await whopWebhookController.receive(
      buildRequest(body("membership.activated", { id: MEMBERSHIP_ID })) as never,
      reply as never,
    )

    assert.equal(state.status, 200, "un fallo del cobro no puede volver 500 un update ya aplicado")
    assert.equal(update.mock.callCount(), 1, "la suscripción se actualiza igual")
    assert.equal(events[0]?.action, "webhook_whop_activated", "la auditoría no fatal sigue escribiéndose")
  })

})
