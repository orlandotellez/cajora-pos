import { readApiUrl } from "@/lib/api-config";
import { crossFetch } from "@/lib/fetch";
import { extractErrorCode, resolveErrorMessage } from "./error-messages";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem("auth-token");
  } catch {
    return null;
  }
}

// 403 con este code (store.guard) = JWT sin storeId → se fuerza re-login limpio.
const STORE_CONTEXT_REQUIRED = "STORE_CONTEXT_REQUIRED";

function clearAuthSession() {
  localStorage.removeItem("auth-token");
  localStorage.removeItem("auth-refresh-token");
  localStorage.removeItem("auth-user");
  localStorage.removeItem("auth-store");
  window.location.href = "/auth";
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${readApiUrl()}${path}`);

  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) url.searchParams.set(key, String(val));
    }
  }

  const headers: Record<string, string> = {};

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await crossFetch(url.toString(), {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // El detalle real (Rust `http_request` o fetch del browser) solo va al log —
    // NUNCA al usuario (puede traer IPs, URLs, ECONNREFUSED, etc.).
    console.error(`[API] ${method} ${path} failed:`, err);
    throw new ApiError(0, "NETWORK_ERROR", resolveErrorMessage(0, null));
  }

  if (res.status === 204) return undefined as T;

  // Body no-JSON (páginas de error de proxies, etc.) no debe crashear.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const code = extractErrorCode(data) ?? (res.status === 403 ? "FORBIDDEN" : "UNKNOWN");

    // 403 con code STORE_CONTEXT_REQUIRED (store.guard): el JWT no tiene storeId.
    // Se fuerza un re-login limpio. Cualquier OTRO 403 (p.ej. FORBIDDEN de
    // adminGuard) propaga el ApiError sin logout — el usuario ve "Acceso denegado".
    if (res.status === 403 && code === STORE_CONTEXT_REQUIRED) {
      clearAuthSession();
      return undefined as T;
    }

    throw new ApiError(res.status, code, resolveErrorMessage(res.status, data, code));
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>("GET", path, undefined, params),

  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, body),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, body),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, body),

  delete: <T>(path: string) =>
    request<T>("DELETE", path),
};
