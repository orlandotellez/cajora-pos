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

type StatusHandler = (connected: boolean) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeUp = null;
      resolve();
    }, ms);
    wakeUp = () => {
      clearTimeout(timer);
      wakeUp = null;
      resolve();
    };
  });
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_CONSECUTIVE_ERRORS = 5;
const COOLDOWN_MS = 60_000;
const STALE_AFTER_MS = 40_000;
const STALE_CHECK_MS = 5_000;

const handlers = new Set<Handler>();
let started = false;

// Estado de la conexión actual (para abortarla desde fuera: watchdog/resume/online).
let controller: AbortController | null = null;
let wakeUp: (() => void) | null = null;
let lastMessageAt = 0;

// Salud de la conexión SSE: `true` mientras el stream esté abierto y
// entregando datos (heartbeats incluidos). Los hooks la usan para el polling
// adaptativo: si el SSE está conectado, el poll se pausa; si cae, se reanuda.
let connected = false;
const statusHandlers = new Set<StatusHandler>();

function setConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  for (const handler of statusHandlers) {
    try {
      handler(value);
    } catch {
      // un handler que falla no debe romper el resto
    }
  }
}

/** ¿Está el SSE conectado y entregando eventos en este momento? */
export function isRealtimeConnected(): boolean {
  return connected;
}

/**
 * Suscribe un handler a los cambios de salud de la conexión SSE
 * (`true` = conectado, `false` = caído/reconectando). Al suscribirse,
 * el handler recibe inmediatamente el estado actual.
 *
 * A diferencia de `subscribeRealtime`, esto NO abre la conexión: es un
 * observador pasivo (útil para hooks con polling que solo quieren saber
 * cuándo pausar/reanudar).
 */
export function subscribeRealtimeStatus(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  try {
    handler(connected);
  } catch {
    // ignorar fallo del handler inicial
  }
  return () => {
    statusHandlers.delete(handler);
  };
}

/** Aborta la conexión actual (si la hay) y despierta el bucle para reconectar ya. */
function reconnectNow(reason: string): void {
  console.info(`[SSE] reconectando (${reason})`);
  if (controller) {
    controller.abort();
    controller = null;
  }
  const wake = wakeUp;
  wakeUp = null;
  wake?.();
}

function startConnection(): void {
  const base = readApiUrl().replace(/\/+$/, "");
  const url = `${base}/events`;
  let consecutiveErrors = 0;

  async function connect(): Promise<void> {
    for (; ;) {
      let deliveredEvent = false;
      const ctrl = new AbortController();
      controller = ctrl;
      const connectedAt = Date.now();

      const watchdog = setInterval(() => {
        if (ctrl.signal.aborted) {
          clearInterval(watchdog);
          return;
        }
        const lastSeen = Math.max(lastMessageAt, connectedAt);
        if (Date.now() - lastSeen > STALE_AFTER_MS) {
          console.warn("[SSE] sin datos por 40s+: socket muerto (Android), reconectando");
          clearInterval(watchdog);
          consecutiveErrors = 0; // no es falla del backend: es la red móvil
          ctrl.abort();
        }
      }, STALE_CHECK_MS);

      try {
        const token = getAuthToken();
        const res = await globalThis.fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }
        console.info("[SSE] conectado a /events");
        lastMessageAt = Date.now();
        setConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (; ;) {
          const { done, value } = await reader.read();
          if (done) {
            setConnected(false);
            break;
          }
          lastMessageAt = Date.now();
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
        clearInterval(watchdog);
        if (ctrl.signal.aborted) continue; // abort intencional: reconectar ya
        if (!deliveredEvent) consecutiveErrors += 1;
        await sleep(RECONNECT_DELAY_MS);
      } catch (err) {
        clearInterval(watchdog);
        setConnected(false);
        if (ctrl.signal.aborted) {
          continue;
        }
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

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    reconnectNow("app en primer plano");
  });

  window.addEventListener("online", () => reconnectNow("red recuperada"));
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
