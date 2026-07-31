import styles from "./Header.module.css"

interface HeaderProps {
  setBatchModalOpen: () => void
}

export const Header = ({ setBatchModalOpen }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.h1}>Inventario</h1>
            <p className={styles.subtitle}>Control de stock en tiempo real</p>
          </div>
          <button onClick={setBatchModalOpen} className={styles.primaryBtnSmall}>
            Nuevo movimiento agrupado
          </button>
        </div>
      </header>
    </>
  )
}
