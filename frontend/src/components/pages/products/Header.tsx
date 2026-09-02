import { Plus, Upload, Pencil } from "lucide-react"
import { CartIndicator } from "@/components/common/CartIndicator"
import styles from "./Header.module.css"

interface HeaderProps {
  total: number
  setEditing: () => void
  loading?: boolean
  showCreateButton?: boolean
  onImport?: () => void
  showEditMode?: boolean
  editMode?: boolean
  onToggleEditMode?: () => void
}

export const Header = ({ total, setEditing, loading = false, showCreateButton = true, onImport, showEditMode = false, editMode = false, onToggleEditMode }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Productos</h1>
          <p className={styles.subtitle}>
            {loading && total === 0 ? (
              <span className={styles.skeleton} aria-hidden="true" />
            ) : (
              `${total} productos en catálogo`
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <CartIndicator />
          {showEditMode && (
            <button
              onClick={onToggleEditMode}
              className={`${styles.editModeBtn} ${editMode ? styles.editModeBtnActive : ""}`}
              title="Activar o desactivar la selección múltiple (solo admin)"
            >
              <Pencil size={14} /> <span className={styles.editModeLabel}>Modo edición</span>
            </button>
          )}
          {showCreateButton && onImport && (
            <button onClick={onImport} className={styles.secondaryBtn}>
              <Upload size={16} /> <span className={styles.importLabel}>Importar</span>
            </button>
          )}
          {showCreateButton && (
            <button onClick={setEditing} className={styles.primaryBtn}>
              <Plus size={16} /> Nuevo
            </button>
          )}
        </div>
      </header>
    </>
  )
}
