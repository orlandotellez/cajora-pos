import { useEffect, Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { PageLoader } from "./components/common/PageLoader";
import { useAuth } from "./context/AuthContext";
import { SplashScreen } from "./context/AppBootstrap";
import { useSelectAllNumberInputs } from "./hooks/useSelectAllNumberInputs";
import { installModalBackHandler, installNativeBackHandler } from "./lib/modal-back";

export default function App() {
  const { user, loading } = useAuth();
  useSelectAllNumberInputs();

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
    <AppShell>
      {/* Suspense mantiene el shell visible mientras cargan las páginas lazy */}
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
