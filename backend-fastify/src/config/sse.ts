import type { ServerResponse } from "node:http"

/**
 * Hub SSE en memoria (por storeId).
 *
 * - Cada cliente conectado a `GET /api/v1/sales/events` queda registrado en el
 *   Set de su store.
 * - Al crear una venta, `sseBroadcast(storeId, "sale.created", ...)` avisa al
 *   instante a todos los terminales de esa tienda.
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
