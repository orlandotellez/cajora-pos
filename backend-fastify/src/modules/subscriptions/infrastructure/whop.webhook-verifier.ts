import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/config/env"

/**
 * Ventana de replay exigida por la spec Standard Webhooks: 5 minutos. Un
 * `webhook-timestamp` fuera de este rango se rechaza aunque la firma sea válida,
 * de modo que un evento capturado no sirva para reenviarse más tarde.
 */
const REPLAY_WINDOW_SECONDS = 300

const WHOP_SECRET_PREFIX = "ws_"

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = headers[key]
  // Fastify puede entregar el mismo header como array. Se unen los valores con
  // espacio (no se toma solo el primero) porque `webhook-signature` admite varias
  // firmas separadas por espacio y todas deben evaluarse.
  return Array.isArray(value) ? value.join(" ") : value
}

/** Decodifica base64 solo cuando el valor es limpio; si no, devuelve null. */
function tryBase64Decode(value: string): Buffer | null {
  if (value.length === 0) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  const decoded = Buffer.from(value, "base64")
  // Node decodifica base64 de forma laxa (ignora basura); se re-codifica y compara
  // sin relleno para descartar cualquier decodificación parcial.
  const reencoded = decoded.toString("base64").replace(/=+$/, "")
  if (reencoded !== value.replace(/=+$/, "")) return null
  return decoded
}

/**
 * La documentación de Whop no aclara si el HMAC se calcula con el secreto tal cual
 * (incluido el prefijo `ws_`) o con el fragmento posterior a `ws_` ya decodificado
 * en base64. Para no depender de esa ambigüedad se aceptan AMBOS candidatos, siempre
 * derivados del mismo secreto configurado: nunca de un valor externo al env.
 */
export function candidateKeys(secret: string): Buffer[] {
  if (!secret) return []

  const keys: Buffer[] = [Buffer.from(secret, "utf8")]

  if (secret.startsWith(WHOP_SECRET_PREFIX)) {
    const decoded = tryBase64Decode(secret.slice(WHOP_SECRET_PREFIX.length))
    if (decoded) keys.push(decoded)
  }

  return keys
}

/** HMAC-SHA256 en base64 del contenido firmado, con la clave indicada. */
export function signPayload(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64")
}

/**
 * Comparación en tiempo constante. `timingSafeEqual` exige buffers del mismo
 * tamaño, así que se compara primero la longitud: no revela información útil
 * (el tamaño de una firma no es secreto) y evita la excepción por longitudes
 * distintas. El contenido siempre se compara en tiempo constante.
 */
export function constantTimeEquals(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8")
  const providedBuf = Buffer.from(provided, "utf8")
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

/** true si el timestamp cae dentro de la ventana de replay alrededor de `nowSeconds`. */
export function isTimestampFresh(
  timestamp: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const value = Number(timestamp)
  if (!Number.isFinite(value)) return false
  return Math.abs(nowSeconds - value) <= REPLAY_WINDOW_SECONDS
}

export async function verifyWhopWebhook(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): Promise<boolean> {
  if (!env.WHOP_ENABLED) return true

  const secret = env.WHOP_WEBHOOK_SECRET
  if (!secret) return false

  const webhookId = getHeader(headers, "webhook-id")
  const webhookTimestamp = getHeader(headers, "webhook-timestamp")
  const webhookSignature = getHeader(headers, "webhook-signature")

  if (!webhookId || !webhookTimestamp || !webhookSignature) return false
  if (!isTimestampFresh(webhookTimestamp)) return false

  const payload = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const keys = candidateKeys(secret)
  if (keys.length === 0) return false

  const signatures = webhookSignature
    .split(/\s+/)
    .filter((entry) => entry.startsWith("v1,"))
    .map((entry) => entry.slice("v1,".length))

  return signatures.some((signature) =>
    keys.some((key) => constantTimeEquals(signPayload(payload, key), signature)),
  )
}
