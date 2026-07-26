import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./context/AuthContext";
import { SplashScreen } from "./context/AppBootstrap";
import { useSelectAllNumberInputs } from "./hooks/useSelectAllNumberInputs";

export default function App() {
  const { user, loading } = useAuth();
  useSelectAllNumberInputs();

  if (loading) return <SplashScreen />;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
