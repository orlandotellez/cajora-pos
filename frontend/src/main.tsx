import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { AppBootstrap } from "./context/AppBootstrap";
import "./index.css";
import { ToastProvider } from "./components/common/ui/Toast";
import { ErrorBoundary } from "./components/common/ui/ErrorBoundary";
import { isDemoMode, applyDemoSession } from "./mocks/demo";
import { isTauriRuntime } from "./lib/fetch";

async function bootstrap() {
  // Modo demo (?demo=1): se activa el Service Worker de MSW ANTES de montar
  // React. Mientras el worker esté activo, ningún request cruza hacia el
  // backend real: todo se resuelve con datos sintéticos (src/mocks/).
  //
  // SOLO WEB: en Tauri (desktop/Android) los requests van por Rust
  // (`invoke("http_request")`), fuera del alcance del Service Worker, así que
  // el modo demo no aplica — se ignora explícitamente para que nadie crea que
  // la BD está aislada cuando no lo está.
  if (isDemoMode() && !isTauriRuntime()) {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "error",
      serviceWorker: { url: import.meta.env.BASE_URL + "mockServiceWorker.js" },
    });
    applyDemoSession();
  } else if (isDemoMode() && isTauriRuntime()) {
    console.warn(
      "[demo] El modo demo solo funciona en la versión web (app.cajorapos.com?demo=1). En Tauri los requests van por Rust y NO están aislados.",
    );
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppBootstrap>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </AppBootstrap>
    </StrictMode>,
  );
}

void bootstrap();
