import { readApiUrl } from "./api-config";
import { getAuthToken } from "@/api/client";

interface SaleCreatedEvent {
  id: string;
  total?: number;
  user_name?: string;
  created_at?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Se suscribe al stream SSE del backend (`/sales/events`) y llama a
 * `onSaleCreated` al instante cuando se registra una venta en la tienda.
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
 * Nota (producción Tauri): en macOS el origen del webview es `tauri://localhost`;
 * si no está en CORS_ORIGIN, el fetch del webview será bloqueado por CORS y la
 * app cae al polling como respaldo (degradación suave, no error).
 *
 * Devuelve un cleanup que cierra la conexión (usar como return del useEffect).
 * Si el backend no soporta SSE o hay varios errores seguidos, se detiene y el
 * polling existente queda como respaldo.
 */
export function openSalesEvents(onSaleCreated: (sale: SaleCreatedEvent) => void): () => void {
  const base = readApiUrl().replace(/\/+$/, "");
  const url = `${base}/sales/events`;
  const controller = new AbortController();
  let closed = false;
  let consecutiveErrors = 0;

  async function connect(): Promise<void> {
    while (!closed && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
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
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }
        console.info("[SSE] conectado a /sales/events");
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
            if (event === "sale.created" && data) {
              deliveredEvent = true;
              // El stream es funcional: recién acá se resetea el contador.
              consecutiveErrors = 0;
              console.info("[SSE] evento sale.created recibido");
              try {
                onSaleCreated(JSON.parse(data) as SaleCreatedEvent);
              } catch {
                // Evento malformado: ignorar, el polling sigue cubriendo.
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
        if (closed) return;
        if ((err as Error)?.name === "AbortError") return;
        consecutiveErrors += 1;
        console.warn(
          `[SSE] error de conexión (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
          err,
        );
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn("[SSE] se desactivó tras varios errores; queda el polling como respaldo");
        }
        await sleep(Math.min(RECONNECT_DELAY_MS * consecutiveErrors, 10_000));
      }
    }
  }

  void connect();

  return () => {
    closed = true;
    controller.abort();
  };
}
