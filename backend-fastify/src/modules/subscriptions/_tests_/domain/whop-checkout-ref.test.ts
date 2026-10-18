import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { createCheckoutRef, verifyCheckoutRef } from "../../domain/whop-checkout-ref"

const STORE_ID = "store-cajora-123"
const SECRET = "secreto-de-prueba-para-referencias-de-checkout"

/** Decodifica el payload `storeId:issuedAt` de una referencia para manipularla. */
function decodePayload(ref: string): { storeId: string; issuedAt: string } {
  const payload = Buffer.from(ref.split(".")[0], "base64url").toString("utf8")
  const at = payload.lastIndexOf(":")
  return { storeId: payload.slice(0, at), issuedAt: payload.slice(at + 1) }
}

describe("whop-checkout-ref", () => {
  beforeEach(() => {
    mock.restoreAll()
    mock.property(env, "WHOP_CHECKOUT_REF_SECRET", SECRET)
  })
  afterEach(() => mock.restoreAll())

  it("una referencia válida round-trips al mismo store id", () => {
    const ref = createCheckoutRef(STORE_ID)
    assert.equal(verifyCheckoutRef(ref), STORE_ID)
  })

  it("rechaza un store id adulterado (misma firma, otro payload)", () => {
    const ref = createCheckoutRef(STORE_ID)
    const signature = ref.split(".")[1]
    const { issuedAt } = decodePayload(ref)
    const tamperedPayload = Buffer.from(`tienda-ajena:${issuedAt}`, "utf8").toString("base64url")

    assert.equal(verifyCheckoutRef(`${tamperedPayload}.${signature}`), null)
  })

  it("rechaza una firma adulterada", () => {
    const ref = createCheckoutRef(STORE_ID)
    const [payload, signature] = ref.split(".")
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A")

    assert.equal(verifyCheckoutRef(`${payload}.${flipped}`), null)
  })

  it("rechaza una referencia vencida (> 24 h)", () => {
    const issued = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const ref = createCheckoutRef(STORE_ID, issued)

    assert.equal(verifyCheckoutRef(ref, new Date()), null)
  })

  it("acepta una referencia dentro de las 24 h (borde)", () => {
    const issued = new Date(Date.now() - 23 * 60 * 60 * 1000)
    const ref = createCheckoutRef(STORE_ID, issued)

    assert.equal(verifyCheckoutRef(ref, new Date()), STORE_ID)
  })

  it("rechaza formatos malformados", () => {
    assert.equal(verifyCheckoutRef(""), null)
    assert.equal(verifyCheckoutRef("sin-punto"), null)
    assert.equal(verifyCheckoutRef("a.b.c"), null)
    assert.equal(verifyCheckoutRef("!!!.???"), null)
    assert.equal(verifyCheckoutRef("."), null)
    // Payload sin separador `:` (no hay store id que resolver).
    const noSeparator = Buffer.from("sinseparador", "utf8").toString("base64url")
    assert.equal(verifyCheckoutRef(`${noSeparator}.${Buffer.from("x", "utf8").toString("base64url")}`), null)
  })

  it("rechaza una referencia firmada con otro secreto", () => {
    const ref = createCheckoutRef(STORE_ID)
    mock.restoreAll()
    mock.property(env, "WHOP_CHECKOUT_REF_SECRET", "otro-secreto-completamente-distinto")

    assert.equal(verifyCheckoutRef(ref), null)
  })

  it("usa JWT_SECRET como respaldo cuando no hay secreto propio", () => {
    mock.restoreAll()
    mock.property(env, "WHOP_CHECKOUT_REF_SECRET", "")
    const ref = createCheckoutRef(STORE_ID)

    assert.equal(verifyCheckoutRef(ref), STORE_ID)
  })

  it("no incluye el store id crudo en la referencia", () => {
    const ref = createCheckoutRef(STORE_ID)
    assert.equal(ref.includes(STORE_ID), false)
  })
})
