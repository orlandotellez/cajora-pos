import styles from "./Header.module.css"

interface HeaderProps {
  total: number
}

export const Header = ({ total }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Ventas</h1>
          <p className={styles.subtitle}>{total} venta(s) registradas</p>
        </div>
      </header>
    </>
  )
}
