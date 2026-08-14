import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Building2, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import { openCheckout } from "@/lib/checkout-url";
import styles from "./LoginForm.module.css";
import { useTheme } from "@/context/ThemeContext";
import logoDark from "@/assets/logo_dark.svg";
import logoLight from "@/assets/logo_light.svg";

export function LoginForm() {
  const { login } = useAuth();
  const { theme } = useTheme();
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
        <img
          src={theme === "dark" ? logoLight : logoDark}
          alt="Logo"
          className={styles.logoImg}
        />
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
        onClick={() => void openCheckout()}
        className={styles.secondaryButton}
      >
        <Building2 size={16} />
        Crear mi tienda en la web
        <ArrowUpRight size={14} className={styles.secondaryButtonArrow} />
      </button>
    </div>
  );
}
