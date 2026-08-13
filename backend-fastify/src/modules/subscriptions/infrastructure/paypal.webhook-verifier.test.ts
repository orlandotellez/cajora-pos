import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { verifyPayPalWebhook, isTrustedCertUrl } from "./paypal.webhook-verifier"

const WEBHOOK_ID = "test-webhook-id-123"
const BODY = JSON.stringify({ id: "evt-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED" })
const TRANSMISSION_ID = "txn-abc-123"
const TRANSMISSION_TIME = "2026-08-13T12:00:00Z"
const CERT_URL = "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123"

function validHeaders(): Record<string, string> {
  return {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": CERT_URL,
    "paypal-transmission-id": TRANSMISSION_ID,
    "paypal-transmission-time": TRANSMISSION_TIME,
    "paypal-transmission-sig": "sig-falsa-base64",
  }
}

/** Mockea fetch global para responder el OAuth2 y el endpoint de verificación. */
function mockPayPalApi(status: string, opts: { verifyHttpStatus?: number } = {}) {
  const calls: Array<{ url: string; body?: unknown }> = []
  const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, body: init?.body })
    if (url.includes("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    if (url.includes("/verify-webhook-signature")) {
      const payload = JSON.parse(String(init?.body))
      return new Response(
        JSON.stringify({ verification_status: payload.webhook_id === WEBHOOK_ID ? status : "FAILURE" }),
        { status: opts.verifyHttpStatus ?? 200, headers: { "content-type": "application/json" } },
      )
    }
    return new Response("{}", { status: 404 })
  })
  return { calls, fetchMock }
}

describe("verifyPayPalWebhook (verificación vía API de PayPal)", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("acepta un evento real (PayPal devuelve SUCCESS)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalApi("SUCCESS")
    assert.equal(await verifyPayPalWebhook(validHeaders(), BODY), true)
  })

  it("rechaza cuando PayPal devuelve FAILURE", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalApi("FAILURE")
    assert.equal(await verifyPayPalWebhook(validHeaders(), BODY), false)
  })

  it("rechaza un cert_url NO confiable sin contactar a PayPal (anti-SSRF)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    const { fetchMock } = mockPayPalApi("SUCCESS")
    const headers = { ...validHeaders(), "paypal-cert-url": "https://evil.example.com/cert.pem" }
    assert.equal(await verifyPayPalWebhook(headers, BODY), false)
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it("devuelve false sin headers de firma (no crashea)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    assert.equal(await verifyPayPalWebhook({}, BODY), false)
  })

  it("devuelve false sin PAYPAL_WEBHOOK_ID configurado", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", "")
    assert.equal(await verifyPayPalWebhook(validHeaders(), BODY), false)
  })

  it("maneja headers tipo string[] (Fastify puede normalizar así)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalApi("SUCCESS")
    const headers = validHeaders()
    const withArrays: Record<string, string[]> = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, [v]]),
    )
    assert.equal(await verifyPayPalWebhook(withArrays, BODY), true)
  })

  it("body no parseable → false sin contactar a PayPal", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    const { fetchMock } = mockPayPalApi("SUCCESS")
    assert.equal(await verifyPayPalWebhook(validHeaders(), "no-json-{{{"), false)
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it("error de red al contactar a PayPal → lanza (el controller responde 500 y PayPal reintenta)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("network down")
    })
    await assert.rejects(() => verifyPayPalWebhook(validHeaders(), BODY))
  })

  it("PayPal responde 5xx en la verificación → lanza (500 → PayPal reintenta)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalApi("SUCCESS", { verifyHttpStatus: 500 })
    await assert.rejects(() => verifyPayPalWebhook(validHeaders(), BODY))
  })

  it("PayPal responde 4xx en la verificación → false (error definitivo, descartar)", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    mockPayPalApi("SUCCESS", { verifyHttpStatus: 400 })
    assert.equal(await verifyPayPalWebhook(validHeaders(), BODY), false)
  })

  it("modo mock (PAYPAL_ENABLED=false) → acepta sin contactar a PayPal", async () => {
    mock.property(env, "PAYPAL_ENABLED", false)
    const { fetchMock } = mockPayPalApi("SUCCESS")
    assert.equal(await verifyPayPalWebhook(validHeaders(), BODY), true)
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it("envía el webhook_id correcto y el evento parseado a la API de verificación", async () => {
    mock.property(env, "PAYPAL_WEBHOOK_ID", WEBHOOK_ID)
    const { calls } = mockPayPalApi("SUCCESS")
    await verifyPayPalWebhook(validHeaders(), BODY)
    const verifyCall = calls.find((c) => c.url.includes("/verify-webhook-signature"))
    assert.ok(verifyCall, "debe llamar al endpoint de verificación")
    const payload = JSON.parse(String(verifyCall.body))
    assert.equal(payload.webhook_id, WEBHOOK_ID)
    assert.equal(payload.auth_algo, "SHA256withRSA")
    assert.deepEqual(payload.webhook_event, { id: "evt-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED" })
  })
})

describe("isTrustedCertUrl", () => {
  it("acepta hosts sandbox/live de PayPal con https", () => {
    assert.equal(isTrustedCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1"), true)
    assert.equal(isTrustedCertUrl("https://api-m.paypal.com/v1/notifications/certs/CERT-2"), true)
  })
  it("rechaza hosts ajenos, http y valores inválidos", () => {
    assert.equal(isTrustedCertUrl("https://evil.example.com/cert.pem"), false)
    assert.equal(isTrustedCertUrl("http://api.sandbox.paypal.com/cert"), false)
    assert.equal(isTrustedCertUrl("not-a-url"), false)
    assert.equal(isTrustedCertUrl(undefined), false)
  })
})
