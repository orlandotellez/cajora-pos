import { readApiUrl } from "@/lib/api-config";
import { crossFetch } from "@/lib/fetch";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    const message = extractErrorMessage(data) ?? `HTTP ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function extractErrorMessage(data: unknown): string | null {
  if (typeof data === "object" && data !== null) {
    // Object with message field
    if ("message" in data && typeof (data as Record<string, unknown>).message === "string") {
      return (data as Record<string, unknown>).message as string;
    }
    // Array of Zod errors — grab first message
    if (Array.isArray(data) && data.length > 0 && "message" in data[0]) {
      return String(data[0].message);
    }
  }
  return null;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem("auth-token");
  } catch {
    return null;
  }
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
    // El error real desde Rust (o desde fetch del browser)
    console.error(`[API] ${method} ${path} failed:`, err);
    throw new ApiError(0, {
      message: typeof err === "string" ? err : "Error al conectar con el servidor",
    });
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    // Si el backend dice "Store context required" (403), el JWT no tiene storeId.
    // Forzamos re-login limpio.
    if (res.status === 403) {
      localStorage.removeItem("auth-token");
      localStorage.removeItem("auth-refresh-token");
      localStorage.removeItem("auth-user");
      localStorage.removeItem("auth-store");
      window.location.href = "/auth";
      return undefined as T;
    }

    throw new ApiError(res.status, data);
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
