import { useEffect, Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { PageLoader } from "./components/common/PageLoader";
import { useAuth } from "./context/AuthContext";
import { SplashScreen } from "./context/AppBootstrap";
import { useSelectAllNumberInputs } from "./hooks/useSelectAllNumberInputs";
import { useKeyboardInputVisibility } from "./hooks/useKeyboardInputVisibility";
import { installModalBackHandler, installNativeBackHandler } from "./lib/modal-back";
import { isDemoMode } from "./mocks/demo";

export default function App() {
  const { user, loading } = useAuth();
  useSelectAllNumberInputs();
  // El teclado de Android no debe tapar el input enfocado: lo mantiene visible.
  useKeyboardInputVisibility();

  // El botón de retroceso de Android cierra modales en vez de navegar atrás.
  useEffect(() => {
    installModalBackHandler();
    installNativeBackHandler();
  }, []);

  if (loading) return <SplashScreen />;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      {isDemoMode() && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            zIndex: 9999,
            background: "rgba(124, 58, 237, 0.92)",
            color: "#ffffff",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          Modo demo — datos de ejemplo, no se guardan
        </div>
      )}
      <AppShell>
        {/* Suspense mantiene el shell visible mientras cargan las páginas lazy */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </>
  );
}
