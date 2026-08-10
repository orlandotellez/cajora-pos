import type { ServerResponse } from "node:http"
import type { FastifyReply, FastifyRequest } from "fastify"
import type Redis from "ioredis"
import { isOriginAllowed } from "@/config/cors"
import { getRedisClient } from "./redis"

/**
 * Hub SSE (por storeId) con respaldo en Redis pub/sub.
 *
 * - Cada cliente conectado a `GET /api/v1/events` queda registrado en el Set
 *   de su store (en memoria, por instancia).
 * - Al mutar datos (venta, producto, categoría, proveedor, servicio, usuario,
 *   movimiento de inventario, lote), los controllers emiten eventos con
 *   `sseBroadcast(storeId, "recurso.accion", { id })`.
 * - `sseBroadcast` PUBLICÁ en Redis (canal `pos:sse:v1`) Y hace broadcast
 *   local. Cada instancia tiene un suscriptor que recibe los eventos de las
 *   otras instancias y los re-emite a SUS clientes locales. Así, con varias
 *   instancias detrás de un load balancer, un evento emitido en la instancia
 *   A llega a los terminales conectados a la instancia B.
 *
 * Degradación: si Redis no está disponible, `getRedisClient()` retorna un
 * cliente que reintenta, y `publishToRedis` solo publica cuando el cliente
 * está `ready` — la app sigue funcionando en modo single-instance (in-memory)
 * sin error ni colas de memoria.
 */
const clients = new Map<string, Set<ServerResponse>>()

const REDIS_CHANNEL = "pos:sse:v1"

function publishToRedis(storeId: string, event: string, data: unknown): void {
  const client = getRedisClient()
  // Solo publicar si Redis está conectado: evita acumular comandos en cola
  // offline cuando Redis está caído.
  if (!client || client.status !== "ready") return
  client
    .publish(REDIS_CHANNEL, JSON.stringify({ storeId, event, data }))
    .catch(() => { /* si el publish falla, el broadcast local ya cubrió a esta instancia */ })
}

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

/** Broadcast solo a los clientes locales de esta instancia (sin Redis). */
function broadcastLocal(storeId: string, event: string, data: unknown): void {
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

export function sseBroadcast(storeId: string, event: string, data: unknown): void {
  publishToRedis(storeId, event, data)
  broadcastLocal(storeId, event, data)
}

/**
 * Suscriptor Redis: re-emite a los clientes locales los eventos que publicaron
 * OTRAS instancias. `broadcastLocal` (no `sseBroadcast`) evita el bucle de
 * re-publicar lo que ya vino de Redis.
 */
let redisSubscriber: Redis | null = null

export function ensureRedisSubscriber(): void {
  if (redisSubscriber) return
  const client = getRedisClient()
  if (!client) return
  try {
    const subscriber = client.duplicate()
    redisSubscriber = subscriber
    // Sin listener de error, un 'error' no manejado de ioredis CRASHEA el proceso.
    subscriber.on("error", () => { })
    subscriber.subscribe(REDIS_CHANNEL).catch(() => { })
    subscriber.on("message", (_channel, message) => {
      try {
        const { storeId, event, data } = JSON.parse(message) as {
          storeId: string
          event: string
          data: unknown
        }
        broadcastLocal(storeId, event, data)
      } catch {
        // frame corrupto/ajeno al canal: ignorar
      }
    })
  } catch (err) {
    redisSubscriber = null
    console.error("Redis SSE subscriber unavailable:", err)
  }
}

export const closeSseRedis = async (): Promise<void> => {
  if (redisSubscriber) {
    await redisSubscriber.quit().catch(() => {
      redisSubscriber?.disconnect()
    })
    redisSubscriber = null
  }
}

// Conectar el suscriptor apenas arranca la app (best effort).
ensureRedisSubscriber()

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
