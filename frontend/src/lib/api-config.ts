import { crossFetch } from "@/lib/fetch";

export const API_URL_STORAGE_KEY = "POS_API_URL";
export const BOOTSTRAP_URL =
  "https://pub-17156739f1d5412cb62a579bb0ccbc35.r2.dev/config-api.json";
export const BOOTSTRAP_FETCH_TIMEOUT_MS = 2500;
export const DEFAULT_API_URL = "http://192.168.0.10:3000/api/v1";

/**
 * URL de producción que devuelve el bootstrap remoto (config-api.json).
 * Se usa como fallback cuando el fetch del bootstrap falla.
 * Mantener sincronizada con el valor en config-api.json del repo.
 */
export const FALLBACK_PRODUCTION_URL = "https://pos-system-production-6509.up.railway.app/api/v1";

// En dev (vite dev / pnpm dev) se usa el servidor local
// En producción se usa la URL obtenida del bootstrap remoto
// Para probar bootstrap en dev: VITE_FORCE_PRODUCTION=true pnpm tauri dev
const IS_DEV = import.meta.env.VITE_FORCE_PRODUCTION === "true" ? false : import.meta.env.DEV === true;

export function isValidApiUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value);
}

export function readApiUrl(): string {
  if (IS_DEV) return DEFAULT_API_URL;

  try {
    const stored = localStorage.getItem(API_URL_STORAGE_KEY);
    if (isValidApiUrl(stored)) return stored;
  } catch { }
  return DEFAULT_API_URL;
}

export function writeApiUrl(value: string): void {
  try {
    localStorage.setItem(API_URL_STORAGE_KEY, value);
  } catch { }
}

// ===========================================================================
// Bootstrap remoto (config-api.json en el bucket R2)
//
// Un solo fetch trae TODO lo que la app necesita al arrancar:
//   - current_api_url → URL del API a usar
//   - app_version     → última versión publicada (para el auto-update)
//   - apk_url         → APK directo para descargar (Android)
// ===========================================================================

export interface BootstrapResult {
  apiUrl: string;
  appVersion: string | null;
  apkUrl: string | null;
}

/**
 * Descarga y valida el config remoto.
 *
 * Devuelve:
 *  - `BootstrapResult` con la URL resuelta (y opcionalmente versión/APK)
 *    cuando el fetch funcionó o cuando falló pero hay fallback de producción.
 *  - `null` SOLO cuando el fetch respondió pero la `current_api_url` es
 *    inválida → la app debe pedir la URL manualmente.
 */
export async function fetchBootstrap(
  externalSignal?: AbortSignal,
): Promise<BootstrapResult | null> {
  // En dev no consultamos el bootstrap remoto: usamos el servidor local directamente
  if (IS_DEV) {
    return { apiUrl: DEFAULT_API_URL, appVersion: null, apkUrl: null };
  }

  if (externalSignal?.aborted) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    BOOTSTRAP_FETCH_TIMEOUT_MS,
  );
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort);
  try {
    const response = await crossFetch(BOOTSTRAP_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      cache: "no-cache",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      current_api_url?: unknown;
      app_version?: unknown;
      apk_url?: unknown;
    };
    if (!isValidApiUrl(data.current_api_url)) return null;
    if (externalSignal?.aborted) return null;
    return {
      apiUrl: data.current_api_url,
      appVersion:
        typeof data.app_version === "string" && data.app_version.trim() !== ""
          ? data.app_version.trim()
          : null,
      apkUrl:
        typeof data.apk_url === "string" && /^https?:\/\/\S+$/i.test(data.apk_url)
          ? data.apk_url
          : null,
    };
  } catch (err) {
    // Si el fetch remoto falla (ej. Rust reqwest, red, TLS), usamos la URL de producción
    // como fallback para que la app pueda arrancar sin intervención manual.
    console.warn("[bootstrap] fetch remoto falló, usando URL de producción como fallback:", err);
    return { apiUrl: FALLBACK_PRODUCTION_URL, appVersion: null, apkUrl: null };
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}
