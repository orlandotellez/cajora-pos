import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Detecta si la app está corriendo dentro de Tauri (desktop o Android).
 * En web plano `window.__TAURI_INTERNALS__` no existe, lo que rompe
 * al invocar el plugin HTTP.
 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Fetch unificado que funciona en todas las plataformas:
 * - Tauri (Android, Desktop): usa el fetch del plugin HTTP, que no tiene restricciones CORS.
 * - Web plano: usa `globalThis.fetch`. El plugin Tauri no se invoca porque
 *   `window.__TAURI_INTERNALS__` es undefined y lanzaría un TypeError.
 */
export async function crossFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (isTauriRuntime()) {
    return tauriFetch(input, init);
  }
  return globalThis.fetch(input, init);
}
