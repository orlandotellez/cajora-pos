import { Plus } from "lucide-react"
import styles from "./Header.module.css"

interface HeaderProps {
  total: string
  setEditing: () => void
}

export const Header = ({ total, setEditing }: HeaderProps) => {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Servicios</h1>
          <p className={styles.subtitle}>{total} servicios en catálogo</p>
        </div>
        <button onClick={setEditing} className={styles.primaryBtn}>
          <Plus size={16} /> Nuevo
        </button>
      </header>
    </>
  )
}
