import { X, Trash2 } from "lucide-react"
import styles from "./EditCategoryModal.module.css"
import React from "react"
import { useModalBack } from "@/hooks/useModalBack"

type Form = { name: string, description: string }

interface EditCategoryModalProps {
  isNew: boolean
  setEditing: () => void
  form: Form
  setForm: React.Dispatch<React.SetStateAction<Form>>
  handleSave: (e: React.FormEvent) => Promise<void>
  submitting: boolean
  /** Callback para eliminar la categoría. Si no se provee, no se muestra la danger zone. */
  onDelete?: () => void
}

export const EditCategoryModal = ({ isNew, setEditing, form, setForm, handleSave, submitting, onDelete }: EditCategoryModalProps) => {
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(setEditing);
  return (
    <>
      <div className={styles.overlay} onClick={setEditing}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{isNew ? "Nueva categoría" : "Editar categoría"}</h2>
            <button onClick={setEditing} className={styles.modalClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className={styles.modalForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={styles.textarea}
                rows={3}
              />
            </div>

            <div className={styles["form-actions"]}>
              <button
                type="submit"
                className={`${styles.primaryBtn} ${styles["btn-fit"]}`}
                disabled={submitting}
              >
                {submitting ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={setEditing}
                className={styles.secondaryBtn}
              >
                Cancelar
              </button>
            </div>

            {!isNew && onDelete && (
              <section className={styles.dangerZone}>
                <h3 className={styles.dangerTitle}>Zona de peligro</h3>
                <p className={styles.dangerHint}>
                  Eliminar esta categoría es una acción permanente y no se puede deshacer.
                </p>
                <button type="button" onClick={onDelete} className={styles.dangerBtn}>
                  <Trash2 size={14} />
                  Eliminar categoría
                </button>
              </section>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
