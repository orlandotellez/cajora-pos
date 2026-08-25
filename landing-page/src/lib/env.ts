/**
 * Detect if we're running in a native app (Tauri desktop/mobile) vs a web browser.
 * In native apps, cookies don't work reliably, so we use localStorage + Bearer tokens.
 * In web browsers, we use httpOnly cookies for better security.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri sets __TAURI__ on the window object
  return "__TAURI__" in window;
}

/**
 * Should we use cookies for auth persistence?
 * - Web browser: YES (httpOnly cookies are more secure)
 * - Native app (Tauri): NO (use localStorage + Bearer tokens)
 */
export function useCookiesForAuth(): boolean {
  return !isNativeApp();
}
