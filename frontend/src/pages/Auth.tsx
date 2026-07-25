import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { ShoppingCart, Package, BarChart3, Shield, Sun, Moon } from "lucide-react";
import styles from "./Auth.module.css";

type AuthMode = "login" | "register";

export default function Auth() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");

  if (!loading && user) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className={styles.container}>
      <button onClick={toggle} className={styles.themeToggle}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className={styles.brand}>
        <div className={styles.brandInner}>
          <h1 className={styles.brandTitle}>Caja</h1>
          <p className={styles.brandSubtitle}>Sistema de Punto de Venta e Inventario</p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <ShoppingCart size={18} />
              <span>Ventas rápidas con escáner y búsqueda</span>
            </div>
            <div className={styles.feature}>
              <Package size={18} />
              <span>Gestión de productos y categorías</span>
            </div>
            <div className={styles.feature}>
              <BarChart3 size={18} />
              <span>Reportes de ventas e inventario</span>
            </div>
            <div className={styles.feature}>
              <Shield size={18} />
              <span>Control de acceso por roles</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formPanel}>
        {mode === "login" ? (
          <LoginForm onRegisterClick={() => setMode("register")} />
        ) : (
          <RegisterForm onBackClick={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}
