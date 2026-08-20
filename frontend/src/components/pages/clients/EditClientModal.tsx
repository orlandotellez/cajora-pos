import { X } from "lucide-react";
import styles from "./EditClientModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

type Form = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
};

interface EditClientModalProps {
  isNew: boolean;
  setEditing: () => void;
  handleSave: (e: React.FormEvent) => Promise<void>;
  form: Form;
  setForm: (value: Form) => void;
  submitting: boolean;
}

export const EditClientModal = ({
  isNew,
  setEditing,
  handleSave,
  form,
  setForm,
  submitting,
}: EditClientModalProps) => {
  useModalBack(setEditing);
  return (
    <div className={styles.overlay} onClick={setEditing}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isNew ? "Nuevo cliente" : "Editar cliente"}
          </h2>
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
          <div className={styles["form-grid"]}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={styles.input}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Dirección</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={styles.textarea}
              rows={3}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={styles.textarea}
              rows={3}
            />
          </div>
          <div className={styles.field}>
            <label className={styles["checkbox-label"]}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              Activo
            </label>
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
        </form>
      </div>
    </div>
  );
};
