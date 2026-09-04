import { useCookiesForAuth } from './env';
import { saveSession } from './session';

const SESSION_KEY = "caja_checkout";

interface SsoSession {
  accessToken?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

function readSession(): SsoSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * Challenge the SSO endpoint to get a code.
 * - Web: uses httpOnly cookies (credentials: 'include')
 * - Native app: uses Bearer token from localStorage
 */
async function challenge(apiUrl: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiUrl}/auth/sso/challenge`, {
    method: "POST",
    headers,
    credentials: useCookiesForAuth() ? "include" : undefined,
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.code === "string" && data.code.length > 0 ? data.code : null;
}

async function fetchSsoCode(): Promise<string | null> {
  const apiUrl = import.meta.env.PUBLIC_API_URL;
  const session = readSession();

  if (useCookiesForAuth()) {
    // Web: try with cookies first (no token needed)
    let code = await challenge(apiUrl).catch(() => null);
    if (code) return code;

    // Cookies might have expired, try refresh
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        code = await challenge(apiUrl).catch(() => null);
      }
    } catch {
      // ignore
    }
    return code;
  }

  // Native app: use Bearer token from localStorage
  if (!session?.accessToken) return null;

  let code = await challenge(apiUrl, session.accessToken).catch(() => null);

  if (!code && session.refreshToken) {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.accessToken) {
          saveSession({ ...session, accessToken: data.accessToken });
          code = await challenge(apiUrl, data.accessToken).catch(() => null);
        }
      }
    } catch {
      return null;
    }
  }

  return code;
}

export async function goToPosWithSso(opts?: { newTab?: boolean }): Promise<void> {
  const posUrl = import.meta.env.PUBLIC_POS_URL;
  const isNativeApp = '__TAURI__' in window;
  const useNewTab = !!opts?.newTab && !isNativeApp;
  // Abre la pestaña de forma síncrona (gesto del usuario) para no caer en bloqueadores;
  // la URL final se asigna al resolver el código SSO.
  const win = useNewTab ? window.open('', '_blank') : null;

  const code = await fetchSsoCode().catch(() => null);
  const url = code ? `${posUrl}/auth?code=${encodeURIComponent(code)}` : posUrl;

  if (win) {
    win.opener = null;
    win.location.href = url;
  } else {
    window.location.href = url;
  }
}
