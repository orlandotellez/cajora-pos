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
 * llamador siga con la respuesta original (401 o 403), y la promesa compartida se limpia
 * siempre para no dejar a los siguientes llamadores pegados a un fallo viejo.
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

  // Se reintenta con 401 y también con 403: un 403 no siempre es un problema de permisos.
  // `STORE_CONTEXT_REQUIRED` es justo lo que se ve cuando la sesión quedó sin contexto de
  // tienda (access token vencido y backend autenticando con el refresh), y el cliente no
  // puede distinguirlo de un 403 real sin parsear el body. Refrescar sale gratis cuando el
  // 403 sí es de permisos: el reintento vuelve a dar 403 y el llamador se queda con ese.
  if (!useCookiesForAuth() || (first.status !== 401 && first.status !== 403)) return first;

  const refreshed = await refreshSession();

  if (refreshed) {
    return fetch(input, { ...init, credentials: 'include' });
  }

  return first;
}
