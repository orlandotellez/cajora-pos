import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./context/AuthContext";
import { SplashScreen } from "./context/AppBootstrap";

export default function App() {
  const { user, loading } = useAuth();

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
