export const SESSION_KEY = "caja_checkout";

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  storeName?: string;
  email?: string;
  emailVerified?: boolean;
  paypalMounted?: boolean;
  maxStep?: number;
  paid?: boolean;
}

export function readSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(data: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}