const SESSION_KEY = "caja_checkout";

interface SsoSession {
  accessToken?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

function readSession(): SsoSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveSession(data: SsoSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

async function challenge(apiUrl: string, token: string): Promise<string | null> {
  const res = await fetch(`${apiUrl}/auth/sso/challenge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.code === "string" && data.code.length > 0 ? data.code : null;
}

async function fetchSsoCode(): Promise<string | null> {
  const apiUrl = import.meta.env.PUBLIC_API_URL;
  let session = readSession();
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
          session = { ...session, accessToken: data.accessToken };
          saveSession(session);
          code = await challenge(apiUrl, data.accessToken).catch(() => null);
        }
      }
    } catch {
      return null;
    }
  }

  return code;
}

export async function goToPosWithSso(): Promise<void> {
  const posUrl = import.meta.env.PUBLIC_POS_URL;
  const code = await fetchSsoCode().catch(() => null);

  if (code) {
    window.location.href = `${posUrl}/auth?code=${encodeURIComponent(code)}`;
  } else {
    window.location.href = posUrl;
  }
}
