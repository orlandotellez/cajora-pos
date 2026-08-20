import type { AuthUser, Store } from "@/api/auth";
import { DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN, DEMO_USER, DEMO_STORE } from "./fixtures";

/**
 * Detección y sesión del modo demo.
 *
 * El modo demo se activa con el query param `?demo` (o `?demo=1`) en la URL:
 *   https://app.cajorapos.com?demo=1
 *
 * Mientras el worker de MSW esté activo, TODO request HTTP de la app se
 * resuelve con datos sintéticos. Nada sale a la red real.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("demo");
}

/**
 * Establece la sesión demo en localStorage ANTES de que React monte,
 * para que AuthContext inicialice ya logueado y el visitante caiga
 * directo en el POS sin pasar por el login.
 *
 * En la demo SIEMPRE se usa la sesión demo (aunque el browser tenga
 * una sesión real guardada): así el comportamiento es predecible y
 * ningún token real se envía al backend (que de todos modos está
 * aislado por el Service Worker).
 */
export function applyDemoSession(): void {
  try {
    localStorage.setItem("auth-token", DEMO_ACCESS_TOKEN);
    localStorage.setItem("auth-refresh-token", DEMO_REFRESH_TOKEN);
    localStorage.setItem("auth-user", JSON.stringify(DEMO_USER satisfies AuthUser));
    localStorage.setItem("auth-store", JSON.stringify(DEMO_STORE satisfies Store));
  } catch {
    // almacenamiento no disponible: la app igual funciona (sesión en memoria)
  }
}