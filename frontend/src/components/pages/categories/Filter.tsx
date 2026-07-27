import { Search } from "lucide-react"
import styles from "./Filter.module.css"

interface FilterProps {
  q: string
  setSearch: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const Filter = ({ q, setSearch }: FilterProps) => {
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={setSearch}
            placeholder="Buscar por nombre o descripción…"
            className={styles.searchInput}
          />
        </div>
      </div>
    </>
  )
}
