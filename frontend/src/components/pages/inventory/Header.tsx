import { PageTitle } from "@/components/common/PageTitle";
import { useEffect, useState } from "react"
import { MoreVertical, Plus, Upload } from "lucide-react"
import styles from "./Header.module.css"

interface HeaderProps {
  setBatchModalOpen: () => void
  onCreateProduct?: () => void
  onImport?: () => void
  canWrite?: boolean
}

export const Header = ({ setBatchModalOpen, onCreateProduct, onImport, canWrite = false }: HeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const showMenu = canWrite && !!onImport

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [menuOpen])

  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div>
          <PageTitle path="/inventory" className={styles.h1}>Inventario</PageTitle>
          <p className={styles.subtitle}>Stock, productos y movimientos</p>
        </div>

        {showMenu && (
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más acciones"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>

            {menuOpen && (
              <>
                <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
                <div className={styles.menu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuOpen(false)
                      onImport?.()
                    }}
                  >
                    <Upload size={16} /> Importar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.headerActions}>
        <button onClick={setBatchModalOpen} className={styles.secondaryBtn}>
          Movimiento agrupado
        </button>
        {canWrite && onCreateProduct && (
          <button onClick={onCreateProduct} className={styles.primaryBtnSmall}>
            <Plus size={16} /> Nuevo producto
          </button>
        )}
      </div>
    </header>
  )
}
