import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Redirige a `/pos` (con `replace: true`) si el usuario autenticado
 * no es administrador.
 *
 * Centraliza el guard inline que existía en `pages/Settings.tsx` y
 * `pages/Users.tsx` (`useEffect(() => if (user.role !== "admin") navigate("/pos"))`).
 *
 * **Uso**:
 * ```tsx
 * export default function Settings() {
 *   useAdminGuard();
 *   // ... resto del componente
 * }
 * ```
 *
 * **Comportamiento**:
 *   - Mientras `AuthContext.loading === true`, no redirige (espera).
 *   - Si el usuario es `null` (logout), no redirige (probablemente el
 *     AuthContext ya está navegando a `/auth` por su cuenta).
 *   - Si el rol no es admin (`admin`), navega a `/pos` con `replace: true`
 *     = el back button no lo devuelve a la página admin.
 *   - Si es admin, no hace nada.
 *
 * Por diseño el hook no retorna nada — su único propósito es el
 * side effect de redirect. Quien llama no necesita branches
 * adicionales para "mostrar mientras se está chequeando"; el
 * comportamiento original de las páginas admin era mostrar
 * el contenido completo y dejar que el redirect ocurra.
 */
export function useAdminGuard(): void {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && user.role !== "admin") {
      navigate("/pos", { replace: true });
    }
  }, [user, loading, navigate]);
}
