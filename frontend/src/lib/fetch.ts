import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Fetch unificado que funciona en todas las plataformas:
 * - Tauri (Android, Desktop): usa el fetch del plugin HTTP que no tiene restricciones CORS
 * - Web plano: el plugin @tauri-apps/plugin-http internamente usa globalThis.fetch
 */
export async function crossFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return tauriFetch(input, init);
}
