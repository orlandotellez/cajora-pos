import { Plus, Pencil } from "lucide-react"
import { CartIndicator } from "@/components/common/CartIndicator"
import styles from "./Header.module.css"

interface HeaderProps {
  total: number
  setEditing: () => void
  loading?: boolean
  /** Si es false, oculta el botón "Nuevo" (cajeros sin permiso). */
  showCreateButton?: boolean
  showEditMode?: boolean
  editMode?: boolean
  onToggleEditMode?: () => void
}

export const Header = ({ total, setEditing, loading = false, showCreateButton = true, showEditMode = false, editMode = false, onToggleEditMode }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Servicios</h1>
          <p className={styles.subtitle}>
            {loading && total === 0 ? (
              <span className={styles.skeleton} aria-hidden="true" />
            ) : (
              `${total} servicios en catálogo`
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <CartIndicator />
          {showEditMode && (
            <button
              onClick={onToggleEditMode}
              className={`${styles.editModeBtn} ${editMode ? styles.editModeBtnActive : ""}`}
              title="Activar o desactivar la selección múltiple"
            >
              <Pencil size={14} /> <span className={styles.editModeLabel}>Modo edición</span>
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
