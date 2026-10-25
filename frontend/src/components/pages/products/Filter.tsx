import { Search } from "lucide-react";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { Chip, ChipScroller } from "@/components/common/Chips";
import styles from "./Filter.module.css";

type Category = { id: string; name: string; product_count?: number };

interface FilterProps {
  q: string;
  setSearch: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  unitType: string;
  setUnitType: (value: string) => void;
  setPage: (page: number) => void;
  categories: Category[];
}

export const Filter = ({
  q,
  setSearch,
  categoryId,
  setCategoryId,
  unitType,
  setUnitType,
  setPage,
  categories,
}: FilterProps) => {
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

      <ChipScroller label="Filtrar por categoría">
        <Chip
          active={categoryId === ""}
          onClick={() => {
            setCategoryId("");
            setPage(1);
          }}
        >
          Todas
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => {
              setCategoryId(c.id);
              setPage(1);
            }}
          >
            {c.name}
            {c.product_count != null ? ` (${c.product_count})` : ""}
          </Chip>
        ))}
      </ChipScroller>

      <ChipScroller label="Filtrar por tipo">
        <Chip
          active={unitType === ""}
          onClick={() => {
            setUnitType("");
            setPage(1);
          }}
        >
          Todos
        </Chip>
        {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
          <Chip
            key={value}
            active={unitType === value}
            onClick={() => {
              setUnitType(value);
              setPage(1);
            }}
          >
            {label}
          </Chip>
        ))}
      </ChipScroller>
    </div>
  );
};
