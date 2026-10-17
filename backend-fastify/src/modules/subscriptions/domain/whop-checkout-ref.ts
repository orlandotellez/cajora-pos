import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/config/env"

/**
 * Referencia de checkout firmada. Es **stateless**: no se guarda nada en la DB, la
 * propia referencia lleva el `store_id` y la marca de emisión, y la firma impide que
 * alguien la edite. Así el primer pago puede vincularse a la tienda correcta sin que
 * el `store_id` viaje crudo por el navegador (donde el comprador podría cambiarlo):
 * `metadata` es dato del cliente, no una prueba de identidad.
 */

/** Vencimiento: una referencia de más de 24 h no debe poder canjearse. */
const REF_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Secreto de firma. `WHOP_CHECKOUT_REF_SECRET` permite rotar las referencias sin
 * tocar los JWT; si queda vacío se reusa `JWT_SECRET` (respaldo prometido en el
 * comentario de `.env.example`).
 */
function refSecret(): string {
  return env.WHOP_CHECKOUT_REF_SECRET || env.JWT_SECRET
}

/** base64url sin relleno: seguro para query string y `metadata` de Whop. */
function encode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url")
}

/**
 * Decodifica base64url de forma estricta. Node ignora basura al decodificar, así que
 * se re-codifica y compara: cualquier valor que no round-trip es formato inválido.
 */
function decode(value: string): string | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const decoded = Buffer.from(value, "base64url")
  if (decoded.toString("base64url") !== value) return null
  return decoded.toString("utf8")
}

/** HMAC-SHA256 del payload con el secreto vigente. */
function sign(payload: string): string {
  return createHmac("sha256", refSecret()).update(payload).digest("base64url")
}

/** Comparación en tiempo constante: la longitud no es secreto, el contenido sí. */
function constantTimeEquals(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(provided, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Emite la referencia para una tienda. Formato:
 * `base64url(storeId + ":" + issuedAtMs) + "." + base64url(hmacSha256(payload))`.
 */
export function createCheckoutRef(storeId: string, now: Date = new Date()): string {
  const payload = `${storeId}:${now.getTime()}`
  // `digest("base64url")` ya entrega la firma codificada: no se re-codifica.
  return `${encode(payload)}.${sign(payload)}`
}

/**
 * Devuelve el `store_id` solo si la firma es válida y la referencia no venció.
 * Cualquier otro caso (formato, firma, vencimiento, tienda editada) devuelve `null`:
 * el webhook conserva su comportamiento de "no tocar la DB" ante duda.
 */
export function verifyCheckoutRef(ref: string, now: Date = new Date()): string | null {
  if (!ref) return null

  const parts = ref.split(".")
  if (parts.length !== 2) return null
  const [payloadPart, signaturePart] = parts

  const payload = decode(payloadPart)
  if (!payload) return null

  const separator = payload.lastIndexOf(":")
  if (separator <= 0) return null
  const storeId = payload.slice(0, separator)
  const issuedAt = Number(payload.slice(separator + 1))
  if (!storeId || !Number.isFinite(issuedAt)) return null

  if (now.getTime() - issuedAt > REF_TTL_MS) return null

  if (!constantTimeEquals(sign(payload), signaturePart)) return null

  return storeId
}
