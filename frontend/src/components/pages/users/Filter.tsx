import { Search } from "lucide-react";
import styles from "./Filter.module.css";

interface FilterProps {
  q: string;
  setSearch: (q: string) => void;
}

export function Filter({ q, setSearch }: FilterProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} />
        <input
          value={q}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className={styles.searchInput}
        />
      </div>
    </div>
  );
}
