import { RefreshCw } from "lucide-react"
import styles from "./Header.module.css"

interface HeaderProps {
  total: number
  refreshing?: boolean
  onRefresh?: () => void
  loading?: boolean
}

export const Header = ({ total, refreshing = false, onRefresh, loading = false }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Ventas</h1>
          <p className={styles.subtitle}>
            {loading && total === 0 ? (
              <span className={styles.skeleton} aria-hidden="true" />
            ) : (
              `${total} venta(s) registradas`
            )}
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className={styles.refreshBtn}
            title="Refrescar la tabla con los datos más recientes"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? styles.spinning : undefined} />
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        )}
      </header>
    </>
  )
}
