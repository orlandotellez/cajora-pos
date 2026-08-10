import type { ServerResponse } from "node:http"
import type { FastifyReply, FastifyRequest } from "fastify"
import { isOriginAllowed } from "@/config/cors"

/**
 * Hub SSE en memoria (por storeId).
 *
 * - Cada cliente conectado a `GET /api/v1/events` (o `/sales/events`) queda
 *   registrado en el Set de su store.
 * - Al mutar datos (venta, producto, categoría, proveedor, servicio, usuario,
 *   movimiento de inventario, lote), los controllers emiten eventos con
 *   `sseBroadcast(storeId, "recurso.accion", { id })` y todos los terminales
 *   de esa tienda se enteran al instante.
 *
 * Nota: es in-memory y por instancia. Si mañana se escala a varios procesos,
 * habría que respaldarlo con Redis pub/sub (el cliente Redis ya está declarado
 * en `config/redis.ts`).
 */
const clients = new Map<string, Set<ServerResponse>>()

export function sseSubscribe(storeId: string, res: ServerResponse): void {
  let set = clients.get(storeId)
  if (!set) {
    set = new Set()
    clients.set(storeId, set)
  }
  set.add(res)
}

export function sseUnsubscribe(storeId: string, res: ServerResponse): void {
  const set = clients.get(storeId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) clients.delete(storeId)
}

export function sseBroadcast(storeId: string, event: string, data: unknown): void {
  const set = clients.get(storeId)
  if (!set || set.size === 0) return

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of set) {
    if (res.destroyed || res.writableEnded) {
      set.delete(res)
      continue
    }
    res.write(payload)
  }
  if (set.size === 0) clients.delete(storeId)
}

/**
 * Abre una conexión SSE (hijack + headers CORS + heartbeat) y la registra en
 * el hub de la tienda del request. Compartido por todos los endpoints de
 * eventos (`GET /events`, `GET /sales/events`).
 *
 * Seguridad: usa la misma lista blanca de orígenes que el resto de la API
 * (`isOriginAllowed`) y exige `Access-Control-Allow-Credentials` porque el
 * frontend conecta con `credentials: "include"` — sin ese header el browser
 * bloquea la respuesta silenciosamente.
 */
export function handleSseConnection(request: FastifyRequest, reply: FastifyReply): void {
  const storeId = request.storeId!
  const origin = request.headers.origin
  const raw = reply.raw

  reply.hijack()
  raw.setHeader("Content-Type", "text/event-stream")
  raw.setHeader("Cache-Control", "no-cache")
  raw.setHeader("Connection", "keep-alive")
  raw.setHeader("X-Accel-Buffering", "no")
  if (origin && isOriginAllowed(origin)) {
    raw.setHeader("Access-Control-Allow-Origin", origin)
    raw.setHeader("Access-Control-Allow-Credentials", "true")
    raw.setHeader("Vary", "Origin")
  }
  raw.on("error", () => { })
  raw.flushHeaders()
  raw.write(": connected\n\n")

  sseSubscribe(storeId, raw)

  const heartbeat = setInterval(() => {
    if (raw.destroyed || raw.writableEnded) {
      clearInterval(heartbeat)
      return
    }
    raw.write(": ping\n\n")
  }, 25_000)

  request.raw.on("close", () => {
    clearInterval(heartbeat)
    sseUnsubscribe(storeId, raw)
  })
}
