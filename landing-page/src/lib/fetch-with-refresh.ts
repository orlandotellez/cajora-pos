import { useCookiesForAuth } from './env';

const apiUrl = import.meta.env.PUBLIC_API_URL;

export async function fetchWithRefresh(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const first = await fetch(input, { ...init, credentials: 'include' });

  if (!useCookiesForAuth() || first.status !== 401) return first;

  try {
    const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (refreshRes.ok) {
      return fetch(input, { ...init, credentials: 'include' });
    }
  } catch { }

  return first;
}
