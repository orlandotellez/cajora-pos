import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Store, ShoppingCart, Package, BarChart3, Shield, Building2, ArrowLeft, Sun, Moon, Eye, EyeOff } from "lucide-react";
import styles from "./Auth.module.css";

type AuthMode = "login" | "register";

export default function Auth() {
  const { user, loading, login, registerStore } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");

  if (!loading && user) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className={styles.container}>
      {/* Theme toggle */}
      <button onClick={toggle} className={styles.themeToggle}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Left panel: branding */}
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

      {/* Right panel: form */}
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

function LoginForm({ onRegisterClick }: { onRegisterClick: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formIcon}>
        <Store size={28} />
      </div>
      <h2 className={styles.formTitle}>Iniciar sesión</h2>
      <p className={styles.formSubtitle}>Ingresá tus credenciales para acceder</p>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.input}
            placeholder="admin@ejemplo.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>Contraseña</label>
          <div className={styles.passwordWrapper}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className={styles.passwordToggle}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.button} disabled={submitting}>
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>o</span>
        <span className={styles.dividerLine} />
      </div>

      <button
        type="button"
        onClick={onRegisterClick}
        className={styles.secondaryButton}
      >
        <Building2 size={16} />
        Crear tienda
      </button>
    </div>
  );
}

function RegisterForm({ onBackClick }: { onBackClick: () => void }) {
  const { registerStore } = useAuth();

  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await registerStore({
        storeName,
        storeAddress: storeAddress || undefined,
        storePhone: storePhone || undefined,
        adminName,
        adminEmail,
        adminPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tienda");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formCard}>
      <button type="button" onClick={onBackClick} className={styles.backButton}>
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className={styles.formIcon}>
        <Building2 size={28} />
      </div>
      <h2 className={styles.formTitle}>Crear tienda</h2>
      <p className={styles.formSubtitle}>Registrá tu negocio para empezar a vender</p>

      <form onSubmit={submit} className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Datos de la tienda</legend>

          <div className={styles.field}>
            <label htmlFor="storeName" className={styles.label}>Nombre de la tienda</label>
            <input
              id="storeName"
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              className={styles.input}
              placeholder="Mi Tienda"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="storeAddress" className={styles.label}>Dirección</label>
            <input
              id="storeAddress"
              type="text"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className={styles.input}
              placeholder="Managua, Nicaragua"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="storePhone" className={styles.label}>Teléfono</label>
            <input
              id="storePhone"
              type="tel"
              value={storePhone}
              onChange={(e) => setStorePhone(e.target.value)}
              className={styles.input}
              placeholder="0000-0000"
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Administrador</legend>

          <div className={styles.field}>
            <label htmlFor="adminName" className={styles.label}>Nombre del administrador</label>
            <input
              id="adminName"
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
              className={styles.input}
              placeholder="Admin"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="adminEmail" className={styles.label}>Correo electrónico</label>
            <input
              id="adminEmail"
              type="email"
              autoComplete="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              className={styles.input}
              placeholder="admin@mi-tienda.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="adminPassword" className={styles.label}>Contraseña</label>
            <div className={styles.passwordWrapper}>
              <input
                id="adminPassword"
                type={showAdminPassword ? "text" : "password"}
                autoComplete="new-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={8}
                className={styles.input}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword((p) => !p)}
                className={styles.passwordToggle}
                tabIndex={-1}
                aria-label={showAdminPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </fieldset>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.button} disabled={submitting}>
          {submitting ? "Creando tienda…" : "Crear tienda"}
        </button>
      </form>
    </div>
  );
}