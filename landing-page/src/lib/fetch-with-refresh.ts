import { useCookiesForAuth } from './env';

const apiUrl = import.meta.env.PUBLIC_API_URL;

/**
 * Refresh en curso, compartido por todos los llamadores de la página.
 *
 * El backend rota el refresh token: `authService.refresh` borra la sesión del token
 * presentado y crea una nueva. Si dos requests se topan con el access token vencido a la
 * vez (el perfil dispara `/subscriptions/mine` y `/settings` en paralelo), sin esta
 * deduplicación cada una pide su propio `/auth/refresh`; la segunda llega con un token ya
 * rotado, recibe 401 y su llamador se cree deslogueado. Una sola promesa compartida hace
 * que N 401 provoquen exactamente UN refresh y que todos reintenten después.
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Pide un refresh de sesión. Devuelve `true` si hay access token nuevo.
 * Nunca rechaza: un refresh fallido o un error de red se traduce en `false` para que cada
 * llamador siga con el 401 original, y la promesa compartida se limpia siempre para no
 * dejar a los siguientes llamadores pegados a un fallo viejo.
 */
function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      return refreshRes.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function fetchWithRefresh(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const first = await fetch(input, { ...init, credentials: 'include' });

  if (!useCookiesForAuth() || first.status !== 401) return first;

  const refreshed = await refreshSession();

  if (refreshed) {
    return fetch(input, { ...init, credentials: 'include' });
  }

  return first;
}
