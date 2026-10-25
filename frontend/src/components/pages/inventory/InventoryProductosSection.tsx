import { useState } from "react";
import { Search, AlertTriangle, SlidersHorizontal } from "lucide-react";
import type { Product, Category } from "@/api";
import type { LowStockProduct } from "@/api/inventory";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { Chip, ChipScroller } from "@/components/common/Chips";
import { InventoryTable } from "./InventoryTable";
import { InventoryCards } from "./InventoryCards";
import { useIsMobile } from "@/hooks/useMediaQuery";
import styles from "./InventoryProductosSection.module.css";

type StockFilter = "" | "low" | "out";

interface Props {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  q: string;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;

  categories: Category[];
  categoryId: string;
  setCategoryId: (value: string) => void;
  unitType: string;
  setUnitType: (value: string) => void;
  stockFilter: StockFilter;
  setStockFilter: (value: StockFilter) => void;

  lowStockProducts: LowStockProduct[];
  onViewAlerts: () => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onRowClick?: (product: Product) => void;
  highlightedProductId?: string;
  refreshing?: boolean;
}

export function InventoryProductosSection(props: Props) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const {
    products,
    total,
    page,
    totalPages,
    loading,
    q,
    setSearch,
    setPage,
    categories,
    categoryId,
    setCategoryId,
    unitType,
    setUnitType,
    stockFilter,
    setStockFilter,
    lowStockProducts,
    onViewAlerts,
    onEdit,
    onAdjust,
    onRowClick,
    highlightedProductId,
    refreshing,
  } = props;

  function toggleStockFilter(target: Exclude<StockFilter, "">) {
    setStockFilter(stockFilter === target ? "" : target);
    setPage(1);
  }

  const activeFilters =
    (categoryId ? 1 : 0) + (unitType ? 1 : 0) + (stockFilter ? 1 : 0);

  return (
    <>
      {lowStockProducts.length > 0 && (
        <div className={styles.alert}>
          <AlertTriangle size={16} className={styles.alertIcon} />
          <div className={styles.alertBody}>
            <div className={styles.alertTitle}>
              {lowStockProducts.length} producto(s) con stock bajo
            </div>
            <div className={styles.alertDesc}>
              {lowStockProducts.slice(0, 5).map((p) => p.product_name).join(", ")}
              {lowStockProducts.length > 5 ? "…" : ""}
            </div>
          </div>
          <button type="button" className={styles.alertAction} onClick={onViewAlerts}>
            Ver alertas
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              value={q}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className={styles.searchInput}
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`${styles.filtersBtn} ${filtersOpen ? styles.filtersBtnActive : ""}`}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} />
            <span>Filtros</span>
            {activeFilters > 0 && <span className={styles.filtersCount}>{activeFilters}</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className={styles.filtersPanel}>
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

        <ChipScroller label="Filtrar por stock">
          <Chip active={stockFilter === "low"} onClick={() => toggleStockFilter("low")}>
            Stock bajo
          </Chip>
          <Chip active={stockFilter === "out"} onClick={() => toggleStockFilter("out")}>
            Sin stock
          </Chip>
        </ChipScroller>
          </div>
        )}
      </div>

      {isMobile ? (
        <InventoryCards
          products={products}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={onEdit}
          onAdjust={onAdjust}
          onRowClick={onRowClick}
          highlightedProductId={highlightedProductId}
          refreshing={refreshing}
        />
      ) : (
        <InventoryTable
          products={products}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={onEdit}
          onAdjust={onAdjust}
          onRowClick={onRowClick}
          highlightedProductId={highlightedProductId}
          refreshing={refreshing}
        />
      )}
    </>
  );
}
