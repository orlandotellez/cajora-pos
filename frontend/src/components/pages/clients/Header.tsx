import { Plus, Pencil } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  total: number;
  onNew: () => void;
  loading?: boolean;
  showEditMode?: boolean;
  editMode?: boolean;
  onToggleEditMode?: () => void;
}

export const Header = ({ total, onNew, loading = false, showEditMode = false, editMode = false, onToggleEditMode }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Clientes</h1>
        <p className={styles.subtitle}>
          {loading && total === 0 ? (
            <span className={styles.skeleton} aria-hidden="true" />
          ) : (
            `${total} clientes registrados`
          )}
        </p>
      </div>
      <div className={styles.headerActions}>
        {showEditMode && (
          <button
            onClick={onToggleEditMode}
            className={`${styles.editModeBtn} ${editMode ? styles.editModeBtnActive : ""}`}
            title="Activar o desactivar la selección múltiple"
          >
            <Pencil size={14} /> Modo edición
          </button>
        )}
        <button onClick={onNew} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>
    </header>
  );
};
