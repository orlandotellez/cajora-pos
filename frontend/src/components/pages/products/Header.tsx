import { PageTitle } from "@/components/common/PageTitle";
import { Loader2 } from "lucide-react"
import { CartIndicator } from "@/components/common/CartIndicator"
import styles from "./Header.module.css"

interface HeaderProps {
  total: number
  loading?: boolean
  filling?: boolean
}

export const Header = ({ total, loading = false, filling = false }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div>
        <PageTitle path="/products" className={styles.h1}>Catálogo</PageTitle>
        <p className={styles.subtitle}>
          {loading && total === 0 ? (
            <span className={styles.skeleton} aria-hidden="true" />
          ) : (
            <>
              {total} productos en catálogo
              {filling && (
                <Loader2 size={12} className={styles.fillingSpinner} aria-label="Cargando el resto…" />
              )}
            </>
          )}
        </p>
      </div>
      <div className={styles.headerActions}>
        <CartIndicator />
      </div>
    </header>
  )
}
