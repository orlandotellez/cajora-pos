import { useState } from "react"
import { X, Eye, EyeOff, Shield } from "lucide-react"
import styles from "./EditUserModal.module.css"
import { useModalBack } from "@/hooks/useModalBack"
import { ALL_PERMISSIONS, type Permission } from "@/api/auth"

type Form = {
  name: string
  email: string
  password: string
  role: string
  phone: string
  permissions: Permission[]
}

interface EditUserModalProps {
  isNew: boolean
  setEditing: () => void
  handleSave: (e: React.FormEvent) => Promise<void>
  form: Form
  setForm: (value: Form) => void
  submitting: boolean
}

export const EditUserModal = ({
  isNew,
  setEditing,
  handleSave,
  form,
  setForm,
  submitting
}: EditUserModalProps) => {
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(setEditing);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      <div className={styles.overlay} onClick={setEditing}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{isNew ? "Nuevo usuario" : "Editar usuario"}</h2>
            <button onClick={setEditing} className={styles.modalClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className={styles.modalForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={styles.input} required />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={styles.input} required />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Contraseña {isNew && <span className={styles["required-star"]}>*</span>}
                {!isNew && <span className={styles["password-hint"]}>(dejar vacío para mantener)</span>}
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${styles.input} ${styles.passwordInput}`}
                  required={isNew}
                  minLength={isNew ? 8 : undefined}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={styles.select}>
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={styles.input} />
            </div>

            {form.role === "cajero" && (
              <div className={styles.permissionsSection}>
                <div className={styles.permissionsHeader}>
                  <Shield size={14} />
                  <span className={styles.fieldLabel}>Permisos</span>
                </div>
                <p className={styles.permissionsHint}>
                  Los permisos base (ver catálogo e inventario) siempre están activos.
                </p>
                {ALL_PERMISSIONS.filter((p) => p.key !== "catalog_read" && p.key !== "inventory_read").map((perm) => (
                  <label key={perm.key} className={styles.permissionRow}>
                    <div className={styles.permissionInfo}>
                      <span className={styles.permissionLabel}>{perm.label}</span>
                      <span className={styles.permissionDesc}>{perm.description}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm.key)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.permissions, perm.key]
                          : form.permissions.filter((p) => p !== perm.key)
                        setForm({ ...form, permissions: next })
                      }}
                      className={styles.checkbox}
                    />
                  </label>
                ))}
              </div>
            )}

            <div className={styles["form-actions"]}>
              <button type="submit" className={`${styles.primaryBtn} ${styles["btn-fit"]}`} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={setEditing} className={styles.secondaryBtn}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

