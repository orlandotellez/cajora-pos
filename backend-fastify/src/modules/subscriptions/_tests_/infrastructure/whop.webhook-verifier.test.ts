import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import {
  candidateKeys,
  isTimestampFresh,
  signPayload,
  verifyWhopWebhook,
} from "../../infrastructure/whop.webhook-verifier"

// Clave cruda del webhook y su envoltura "ws_" (Whop entrega el secreto ya codificado).
const RAW_KEY = "cajora-whop-test-key"
const SECRET = `ws_${Buffer.from(RAW_KEY).toString("base64")}`
const WEBHOOK_ID = "msg_2test"
const BODY = JSON.stringify({ type: "membership.activated", data: { id: "mem_123" } })

/** Activa Whop en el env mockeado con el secreto indicado. */
function enableWhop(secret = SECRET): void {
  mock.property(env, "WHOP_ENABLED", true)
  mock.property(env, "WHOP_WEBHOOK_SECRET", secret)
}

/** Timestamp Unix (segundos) desplazado respecto a ahora. */
function timestamp(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds)
}

/** Firma base64 del contenido firmado con la clave dada. */
function signatureFor(key: Buffer, ts: string, body = BODY, id = WEBHOOK_ID): string {
  return signPayload(`${id}.${ts}.${body}`, key)
}

function headers(signature: string, ts: string, id = WEBHOOK_ID): Record<string, string> {
  return {
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature": `v1,${signature}`,
  }
}

const CONFIGURED_KEY = Buffer.from(SECRET, "utf8")

describe("verifyWhopWebhook (Standard Webhooks)", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("acepta una firma válida con la clave tal cual se configuró", async () => {
    enableWhop()
    const ts = timestamp()
    assert.equal(await verifyWhopWebhook(headers(signatureFor(CONFIGURED_KEY, ts), ts), BODY), true)
  })

  it("rechaza un body manipulado (firma calculada sobre otro contenido)", async () => {
    enableWhop()
    const ts = timestamp()
    const sig = signatureFor(CONFIGURED_KEY, ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), JSON.stringify({ tampered: true })), false)
  })

  it("rechaza una firma calculada con un secreto ajeno", async () => {
    enableWhop()
    const ts = timestamp()
    const sig = signatureFor(Buffer.from("otro-secreto-distinto", "utf8"), ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), false)
  })

  it("rechaza cuando falta alguno de los headers requeridos", async () => {
    enableWhop()
    const ts = timestamp()
    const sig = signatureFor(CONFIGURED_KEY, ts)

    const sinFirma = headers(sig, ts) as Record<string, string | undefined>
    delete sinFirma["webhook-signature"]
    assert.equal(await verifyWhopWebhook(sinFirma, BODY), false)

    const sinId = headers(sig, ts) as Record<string, string | undefined>
    delete sinId["webhook-id"]
    assert.equal(await verifyWhopWebhook(sinId, BODY), false)

    const sinTimestamp = headers(sig, ts) as Record<string, string | undefined>
    delete sinTimestamp["webhook-timestamp"]
    assert.equal(await verifyWhopWebhook(sinTimestamp, BODY), false)
  })

  it("rechaza un timestamp viejo fuera de la ventana de replay", async () => {
    enableWhop()
    const ts = timestamp(-301)
    const sig = signatureFor(CONFIGURED_KEY, ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), false)
  })

  it("rechaza un timestamp futuro fuera de la ventana de replay", async () => {
    enableWhop()
    const ts = timestamp(301)
    const sig = signatureFor(CONFIGURED_KEY, ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), false)
  })

  it("acepta timestamps en el borde exacto de la ventana", async () => {
    enableWhop()
    for (const offset of [-300, 300]) {
      const ts = timestamp(offset)
      const sig = signatureFor(CONFIGURED_KEY, ts)
      assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), true)
    }
  })

  it("rechaza un timestamp no numérico", async () => {
    enableWhop()
    const sig = signatureFor(CONFIGURED_KEY, "no-es-un-numero")
    assert.equal(await verifyWhopWebhook(headers(sig, "no-es-un-numero"), BODY), false)
  })

  it("acepta cuando solo la segunda firma del header coincide", async () => {
    enableWhop()
    const ts = timestamp()
    const valida = signatureFor(CONFIGURED_KEY, ts)
    const header = { ...headers(valida, ts), "webhook-signature": `v1,ZmlybWEtaW52YWxpZGE= v1,${valida}` }
    assert.equal(await verifyWhopWebhook(header, BODY), true)
  })

  it("rechaza un header de firmas sin coincidencias", async () => {
    enableWhop()
    const ts = timestamp()
    const header = { ...headers("x", ts), "webhook-signature": "v1,ZmlybWEtaW52YWxpZGE= v1,b3RyYW" }
    assert.equal(await verifyWhopWebhook(header, BODY), false)
  })

  it("acepta una firma derivada del candidato base64 (documentación ambigua)", async () => {
    enableWhop()
    const claves = candidateKeys(SECRET)
    assert.equal(claves.length, 2, "debe ofrecer el secreto crudo y su decodificación base64")
    assert.notEqual(claves[0].toString("base64"), claves[1].toString("base64"))
    const ts = timestamp()
    const sig = signatureFor(claves[1], ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), true)
  })

  it("maneja headers tipo string[] (Fastify puede normalizar así)", async () => {
    enableWhop()
    const ts = timestamp()
    const sig = signatureFor(CONFIGURED_KEY, ts)
    const withArrays: Record<string, string[]> = Object.fromEntries(
      Object.entries(headers(sig, ts)).map(([k, v]) => [k, [v]]),
    )
    assert.equal(await verifyWhopWebhook(withArrays, BODY), true)
  })

  it("devuelve false sin secreto configurado", async () => {
    enableWhop("")
    const ts = timestamp()
    const sig = signatureFor(CONFIGURED_KEY, ts)
    assert.equal(await verifyWhopWebhook(headers(sig, ts), BODY), false)
  })

  it("modo deshabilitado (WHOP_ENABLED=false) acepta sin verificar", async () => {
    mock.property(env, "WHOP_ENABLED", false)
    assert.equal(await verifyWhopWebhook({}, BODY), true)
  })
})

describe("piezas puras del verificador Whop", () => {
  it("isTimestampFresh acepta la ventana y rechaza fuera de ella y valores no numéricos", () => {
    assert.equal(isTimestampFresh("1000", 1000), true)
    assert.equal(isTimestampFresh("700", 1000), true)
    assert.equal(isTimestampFresh("1300", 1000), true)
    assert.equal(isTimestampFresh("699", 1000), false)
    assert.equal(isTimestampFresh("1301", 1000), false)
    assert.equal(isTimestampFresh("abc", 1000), false)
    assert.equal(isTimestampFresh("Infinity", 1000), false)
  })

  it("candidateKeys solo deriva del secreto configurado", () => {
    assert.deepEqual(candidateKeys(""), [])
    const claves = candidateKeys(SECRET)
    assert.equal(claves.length, 2)
    assert.equal(claves[0].toString("utf8"), SECRET)
    assert.equal(claves[1].toString("utf8"), RAW_KEY)
    // Sin prefijo "ws_" solo existe el candidato crudo.
    assert.equal(candidateKeys("secreto-sin-prefijo").length, 1)
    // Un sufijo que no decodifica limpio no produce candidato base64.
    assert.equal(candidateKeys("ws_%%%no-base64%%%").length, 1)
  })
})
