import { useCookiesForAuth } from './env';

export const SESSION_KEY = "caja_checkout";

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  storeName?: string | null;
  email?: string;
  emailVerified?: boolean;
  paypalMounted?: boolean;
  maxStep?: number;
  paid?: boolean;
}

/**
 * Read session data.
 * - Native apps: read from localStorage (includes tokens)
 * - Web: read from localStorage (metadata only, tokens are in httpOnly cookies)
 */
export function readSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Save session data.
 * - Native apps: save everything to localStorage (including tokens)
 * - Web: save metadata only to localStorage (tokens are in httpOnly cookies set by the backend)
 */
export function saveSession(data: SessionData): void {
  if (useCookiesForAuth()) {
    // Web: only store metadata, NOT tokens (they live in httpOnly cookies)
    const { accessToken, refreshToken, ...meta } = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(meta));
  } else {
    // Native app: store everything in localStorage
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }
}

/**
 * Clear session data.
 * - Native apps: clear localStorage
 * - Web: clear localStorage metadata. For full logout, also call the /auth/logout
 *   endpoint which clears the httpOnly cookies on the server side.
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
