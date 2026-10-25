import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
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

function ChipScroller({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(160, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  }

  return (
    <div className={styles.chipsRow}>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => scroll(-1)}
        aria-label={`${label}: ver anteriores`}
      >
        <ChevronLeft size={16} />
      </button>
      <div className={styles.chips} ref={ref} role="group" aria-label={label}>
        {children}
      </div>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => scroll(1)}
        aria-label={`${label}: ver más`}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
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
        <button
          type="button"
          onClick={() => {
            setCategoryId("");
            setPage(1);
          }}
          className={`${styles.chip} ${categoryId === "" ? styles.chipActive : ""}`}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategoryId(c.id);
              setPage(1);
            }}
            className={`${styles.chip} ${categoryId === c.id ? styles.chipActive : ""}`}
          >
            {c.name}
            {c.product_count != null ? ` (${c.product_count})` : ""}
          </button>
        ))}
      </ChipScroller>

      <ChipScroller label="Filtrar por tipo">
        <button
          type="button"
          onClick={() => {
            setUnitType("");
            setPage(1);
          }}
          className={`${styles.chip} ${unitType === "" ? styles.chipActive : ""}`}
        >
          Todos
        </button>
        {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setUnitType(value);
              setPage(1);
            }}
            className={`${styles.chip} ${unitType === value ? styles.chipActive : ""}`}
          >
            {label}
          </button>
        ))}
      </ChipScroller>
    </div>
  );
};
