import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  DEFAULT_API_URL,
  fetchBootstrap,
  isValidApiUrl,
  readApiUrl,
  writeApiUrl,
} from "@/lib/api-config";
import { UpdateProvider, type UpdateInfo } from "@/context/UpdateContext";

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "manual"; inputValue: string; error: string | null }
  | {
    kind: "retrieving";
    prevInputValue: string;
    prevError: string | null;
  };

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid var(--splash-fg, #e2e8f0)",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "spin 0.7s linear infinite",
};

export function SplashScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--splash-bg, #040609)",
        color: "var(--splash-fg, #e2e8f0)",
        fontFamily: "system-ui, sans-serif",
        zIndex: 9999,
      }}
    >
      <div style={spinnerStyle} />
    </div>
  );
}

function ManualConfigForm({
  initialValue,
  initialError,
  onSubmit,
  onRetry,
  retrying,
}: {
  initialValue: string;
  initialError: string | null;
  onSubmit: (url: string) => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!isValidApiUrl(trimmed)) {
      setError(
        "URL inválida. Debe empezar con http:// o https:// y terminar con un host válido.",
      );
      return;
    }
    onSubmit(trimmed);
  };

  const errorId = "api-url-error";
  const showError = error !== null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #0f172a)",
        color: "var(--foreground, #e2e8f0)",
        fontSize: "1rem",
        fontFamily: "system-ui, sans-serif",
        zIndex: 9999,
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--card, #1e293b)",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
          Configurar servidor del POS
        </h2>
        <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>
          No pudimos contactar con el servidor de configuración. Ingresa la URL
          del API de tu tienda manualmente.
        </p>
        <label htmlFor="api-url" style={{ fontSize: "0.85rem", opacity: 0.85 }}>
          URL del API
        </label>        <input
          id="api-url"
          name="api-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoFocus
          required
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          placeholder="https://api.tu-pos.com/api/v1"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${showError ? "#ef4444" : "var(--border, #334155)"}`,
            background: "var(--bg-input, #0f172a)",
            color: "var(--fg-app, #e2e8f0)",
            fontSize: "0.95rem",
          }}
        />
        {showError && (
          <p
            id={errorId}
            role="alert"
            style={{ margin: 0, color: "#ef4444", fontSize: "0.85rem" }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={retrying}
          aria-busy={retrying}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--foreground, #2563eb)",
            color: "var(--background)",
            fontSize: "0.95rem",
            cursor: retrying ? "wait" : "pointer",
            fontWeight: 600,
            opacity: retrying ? 0.6 : 1,
          }}
        >
          Guardar y continuar
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border, #334155)",
            background: "transparent",
            color: "var(--foreground, #e2e8f0)",
            fontSize: "0.85rem",
            cursor: retrying ? "wait" : "pointer",
            opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? "Reintentando…" : "Reintentar descarga automática"}
        </button>
      </form >
    </div >
  );
}

export function AppBootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const result = await fetchBootstrap();
      if (cancelled) return;

      if (result !== null) {
        writeApiUrl(result.apiUrl);
        if (result.appVersion && result.apkUrl) {
          setUpdateInfo({ appVersion: result.appVersion, apkUrl: result.apkUrl });
        }
        setState({ kind: "ready" });
        return;
      }

      // Si ya había una URL cacheada, úsala sin bloquear al usuario.
      if (readApiUrl() !== DEFAULT_API_URL) {
        setState({ kind: "ready" });
        return;
      }

      // Primera ejecución sin conexión: pedir la URL manualmente.
      setState({
        kind: "manual",
        inputValue: "",
        error: null,
      });
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const isRetrieving = state.kind === "retrieving";
  useEffect(() => {
    if (!isRetrieving) return;

    const controller = new AbortController();

    async function retry() {
      const result = await fetchBootstrap(controller.signal);
      if (controller.signal.aborted) return;

      if (result !== null || readApiUrl() !== DEFAULT_API_URL) {
        if (result !== null) {
          writeApiUrl(result.apiUrl);
          if (result.appVersion && result.apkUrl) {
            setUpdateInfo({ appVersion: result.appVersion, apkUrl: result.apkUrl });
          }
        }
        setState({ kind: "ready" });
        return;
      }

      setState((prev) =>
        prev.kind === "retrieving"
          ? {
            kind: "manual",
            inputValue: prev.prevInputValue,
            error:
              "Sigue sin haber conexión con el servidor de configuración.",
          }
          : prev,
      );
    }

    void retry();
    return () => controller.abort();
  }, [isRetrieving]);

  // El prompt de actualización vive en <UpdateProvider>, que se entera del
  // updateInfo y se encarga del auto-prompt y del botón "Actualizar app".
  if (state.kind === "ready") {
    return (
      <UpdateProvider updateInfo={updateInfo}>
        {children}
      </UpdateProvider>
    );
  }
  if (state.kind === "loading") return <SplashScreen />;

  if (state.kind === "retrieving") {
    return (
      <ManualConfigForm
        initialValue={state.prevInputValue}
        initialError={
          state.prevError ?? "Reintentando descarga de configuración…"
        }
        retrying
        onSubmit={(url) => {
          writeApiUrl(url);
          setState({ kind: "ready" });
        }}
        onRetry={() => { }}
      />
    );
  }

  return (
    <ManualConfigForm
      initialValue={state.inputValue}
      initialError={state.error}
      retrying={false}
      onSubmit={(url) => {
        writeApiUrl(url);
        setState({ kind: "ready" });
      }}
      onRetry={() =>
        setState((prev) =>
          prev.kind === "manual"
            ? {
              kind: "retrieving",
              prevInputValue: prev.inputValue,
              prevError: prev.error,
            }
            : prev,
        )
      }
    />
  );
}
