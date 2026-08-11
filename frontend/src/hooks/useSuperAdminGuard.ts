import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Redirige a `/pos` (con `replace: true`) si el usuario autenticado
 * no es super admin. Mismo comportamiento que `useAdminGuard`, pero
 * restringido al rol `super_admin` (vista global cross-tenant).
 */
export function useSuperAdminGuard(): void {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && user.role !== "super_admin") {
      navigate("/pos", { replace: true });
    }
  }, [user, loading, navigate]);
}
