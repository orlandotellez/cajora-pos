import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "@/lib/fetch";

export const CHECKOUT_URL_STORAGE_KEY = "POS_CHECKOUT_URL";

/**
 * URL por defecto de la landing page (checkout) — se usa como fallback
 * cuando no hay VITE_CHECKOUT_URL ni valor del bootstrap remoto.
 * Sin dominio por ahora: la landing corre local con base /pos-system/.
 */
export const DEFAULT_CHECKOUT_URL = "http://localhost:4321/pos-system/";

export function isValidCheckoutUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value);
}

/**
 * Resuelve la URL del checkout de la landing page con esta prioridad:
 *   1. VITE_CHECKOUT_URL (dev / override local)
 *   2. Valor cacheado del bootstrap remoto (config-api.json → checkout_url)
 *   3. Fallback de producción
 */
export function readCheckoutUrl(): string {
  const fromEnv = import.meta.env.VITE_CHECKOUT_URL as string | undefined;
  if (isValidCheckoutUrl(fromEnv)) return fromEnv;

  try {
    const stored = localStorage.getItem(CHECKOUT_URL_STORAGE_KEY);
    if (isValidCheckoutUrl(stored)) return stored;
  } catch {
    /* localStorage no disponible */
  }

  return DEFAULT_CHECKOUT_URL;
}

export function writeCheckoutUrl(value: string): void {
  try {
    localStorage.setItem(CHECKOUT_URL_STORAGE_KEY, value);
  } catch {
    /* localStorage no disponible */
  }
}

/**
 * Abre el checkout de la landing en el navegador del sistema.
 * En Tauri (desktop/Android) usa el plugin opener; en web, window.open.
 */
export async function openCheckout(): Promise<void> {
  const url = readCheckoutUrl();

  if (isTauriRuntime()) {
    try {
      await openUrl(url);
      return;
    } catch (err) {
      console.error("[checkout] No se pudo abrir con el plugin opener:", err);
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}