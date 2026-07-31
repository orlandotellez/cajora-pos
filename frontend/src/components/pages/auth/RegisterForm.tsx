import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Building2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import styles from "./RegisterForm.module.css";

interface Props {
  onBackClick: () => void;
}

export function RegisterForm({ onBackClick }: Props) {
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
