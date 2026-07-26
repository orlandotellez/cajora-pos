import { invoke } from "@tauri-apps/api/core";

// TauriResponse — wrapper que emula el mínimo de la API `Response` del browser
// para que `client.ts` y `api-config.ts` puedan usarlo sin cambios.
class TauriResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  private _body: string;
  private _bodyUsed = false;

  constructor(status: number, body: string) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.headers = new Headers();
    this._body = body;
  }

  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  async json<T = unknown>(): Promise<T> {
    if (this._bodyUsed) throw new TypeError("Body already used");
    this._bodyUsed = true;
    return JSON.parse(this._body) as T;
  }

  async text(): Promise<string> {
    if (this._bodyUsed) throw new TypeError("Body already used");
    this._bodyUsed = true;
    return this._body;
  }
}

// Detección de runtime Tauri

/**
 * Detecta si la app está corriendo dentro de Tauri (desktop o Android).
 * En web plano `window.__TAURI_INTERNALS__` no existe.
 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// crossFetch — fetch unificado para todas las plataformas
//
// Tauri (desktop, Android): usa `invoke("http_request")` que va directo a Rust,
//   donde el reqwest::Client es estático con connection pooling.
//   Esto además bypassea CORS completamente.
//
// Web plano: usa `globalThis.fetch` estándar del navegador.

interface InvokeHttpArgs {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | null;
}

export async function crossFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (isTauriRuntime()) {
    // Normalizar URL
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : "url" in input
            ? (input as Request).url
            : String(input);

    const method = init?.method ?? "GET";
    const headersRaw = init?.headers as Record<string, string> | undefined;
    const body = init?.body as string | null | undefined;

    // Pasar headers solo si existen
    const headers: Record<string, string> = {};
    if (headersRaw) {
      for (const [k, v] of Object.entries(headersRaw)) {
        if (v !== undefined) headers[k] = v;
      }
    }

    // Si no hay body, sacar Content-Type (comportamiento estándar de fetch)
    if (!body && headers["Content-Type"]) {
      delete headers["Content-Type"];
    }

    const args: InvokeHttpArgs = {
      method,
      url,
      headers,
    };
    if (body != null) {
      args.body = body;
    }

    const result = await invoke<{ status: number; body: string }>(
      "http_request",
      { args },
    );

    return new TauriResponse(result.status, result.body) as unknown as Response;
  }

  // Web plano — fetch nativo del navegador
  return globalThis.fetch(input, init);
}
