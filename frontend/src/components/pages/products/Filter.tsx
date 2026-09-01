import { Search } from "lucide-react";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import styles from "./Filter.module.css"

type Category = { id: string, name: string }

interface FilterProps {
  q: string
  setSearch: (value: string) => void
  categoryId: string
  setCategoryId: (value: string) => void
  unitType: string
  setUnitType: (value: string) => void
  setPage: (page: number) => void
  categories: Category[]
}

export const Filter = ({ q, setSearch, categoryId, setCategoryId, unitType, setUnitType, setPage, categories }: FilterProps) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} />
        <input
          value={q}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o categoría"
          className={styles.searchInput}
        />
      </div>
      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value)
          setPage(1)
        }}
        className={styles.filterSelect}
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      <select
        value={unitType}
        onChange={(e) => {
          setUnitType(e.target.value)
          setPage(1)
        }}
        className={styles.filterSelect}
      >
        <option value="">Todos los tipos</option>
        {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  )
}
