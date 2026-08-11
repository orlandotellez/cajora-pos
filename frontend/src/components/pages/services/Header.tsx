import { Plus } from "lucide-react"
import styles from "./Header.module.css"

interface HeaderProps {
  total: number
  setEditing: () => void
  loading?: boolean
}

export const Header = ({ total, setEditing, loading = false }: HeaderProps) => {
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
        <button onClick={setEditing} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>
    </>
  )
}
