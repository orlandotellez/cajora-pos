import { Plus } from "lucide-react"
import { CartIndicator } from "@/components/common/CartIndicator"
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
          <button onClick={setEditing} className={styles.primaryBtn}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </header>
    </>
  )
}
