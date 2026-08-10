import { readApiUrl } from "./api-config";
import { getAuthToken } from "@/api/client";

/**
 * Cliente SSE compartido para tiempo real de la tienda.
 *
 * En lugar de abrir una conexión por página/tabla, TODOS los suscriptores
 * (páginas y hooks) comparten UNA sola conexión por pestaña del navegador:
 *  - La primera suscripción abre la conexión a `GET /api/v1/events`.
 *  - Cada handler recibe `(event, data)` y filtra por el nombre del evento
 *    que le interesa (`sale.created`, `product.updated`, ...).
 *  - La conexión se mantiene abierta durante toda la sesión (1 por terminal),
 *    NO se cierra al desuscribir: así navegar entre páginas no la reinicia.
 *
 * Esto mantiene 1 conexión por terminal sin importar cuántas tablas/páginas
 * estén escuchando (la preocupación de rendimiento del backend).
 *
 * Por qué `fetch` con streaming y NO `EventSource`:
 *  - `EventSource.withCredentials` es getter-only en Firefox y asignarlo lanza
 *    "TypeError: setting getter-only property". Sin él no se mandan cookies
 *    cross-origin y la conexión muere con 401.
 *  - Con `fetch` enviamos el token Bearer por header (igual que `client.ts`),
 *    así la auth no depende de cookies ni de `withCredentials`.
 *  - En Tauri usamos el fetch del webview a propósito: `crossFetch` invoca a
 *    Rust (reqwest) que bufferiza toda la respuesta, y un stream SSE nunca
 *    llegaría completo.
 *
 * Reconexión: backoff con espera creciente; tras 5 errores consecutivos se
 * hace un cooldown largo (60s) y se reintenta (auto-recuperación si el backend
 * vuelve, sin martillar un endpoint caído). Solo el flujo de eventos reales
 * resetea el contador. Si el backend no soporta SSE, el polling existente
 * queda como respaldo mientras tanto.
 */
type Handler = (event: string, data: unknown) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_CONSECUTIVE_ERRORS = 5;
const COOLDOWN_MS = 60_000;

const handlers = new Set<Handler>();
let started = false;

function startConnection(): void {
  const base = readApiUrl().replace(/\/+$/, "");
  const url = `${base}/events`;
  let consecutiveErrors = 0;

  async function connect(): Promise<void> {
    for (;;) {
      let deliveredEvent = false;
      try {
        const token = getAuthToken();
        const res = await globalThis.fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }
        console.info("[SSE] conectado a /events");
        // NOTA: no reseteamos consecutiveErrors aquí. Si el server cierra el
        // stream al instante (endpoint no funcional), los cierres limpios sin
        // eventos se cuentan como error y se frena el bucle; solo el flujo de
        // eventos reales (abajo) lo resetea.

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          // Parsear frames SSE separados por línea en blanco.
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const event = /^event: (.+)$/m.exec(frame)?.[1];
            const data = /^data: (.+)$/m.exec(frame)?.[1];
            if (!event || !data) continue; // heartbeat/comentarios

            deliveredEvent = true;
            // El stream es funcional: recién acá se resetea el contador.
            consecutiveErrors = 0;
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data; // payload no-JSON: pasarlo crudo
            }
            for (const handler of handlers) {
              try {
                handler(event, parsed);
              } catch {
                // un handler que falla no debe matar al resto ni a la conexión
              }
            }
          }
        }

        // El server cerró el stream (p. ej. restart): reconectar tras un respiro.
        // Si se cerró sin entregar ni un evento, el endpoint no es funcional:
        // contar como error para no reconectar infinitamente.
        if (!deliveredEvent) consecutiveErrors += 1;
        await sleep(RECONNECT_DELAY_MS);
      } catch (err) {
        consecutiveErrors += 1;
        console.warn(
          `[SSE] error de conexión (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
          err,
        );
        await sleep(Math.min(RECONNECT_DELAY_MS * consecutiveErrors, 10_000));
      }

      // Cooldown tras errores repetidos: reintentar despacio en vez de
      // martillar o rendirse para siempre (auto-recuperación).
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn("[SSE] endpoint no disponible; reintentando en 60s (queda el polling como respaldo)");
        await sleep(COOLDOWN_MS);
        consecutiveErrors = 0;
      }
    }
  }

  void connect();
}

/**
 * Suscribe un handler a los eventos en tiempo real de la tienda.
 * Devuelve el cleanup que desuscribe (usar como return del useEffect).
 *
 * La conexión se abre con la primera suscripción y queda abierta durante toda
 * la sesión (no se cierra al desuscribir) — navegar entre páginas no la
 * reinicia, y el backend mantiene 1 conexión por terminal.
 */
export function subscribeRealtime(handler: Handler): () => void {
  handlers.add(handler);
  if (!started) {
    started = true;
    startConnection();
  }
  return () => {
    handlers.delete(handler);
  };
}
