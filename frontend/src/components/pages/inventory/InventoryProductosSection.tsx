import { Search, AlertTriangle } from "lucide-react";
import type { Product, Category } from "@/api";
import type { LowStockProduct } from "@/api/inventory";
import { InventoryTable } from "./InventoryTable";
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
  stockFilter: StockFilter;
  setStockFilter: (value: StockFilter) => void;

  lowStockProducts: LowStockProduct[];
  onAdjust: (product: Product) => void;
}

export function InventoryProductosSection(props: Props) {
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
    stockFilter,
    setStockFilter,
    lowStockProducts,
    onAdjust,
  } = props;

  function toggleStockFilter(target: Exclude<StockFilter, "">) {
    setStockFilter(stockFilter === target ? "" : target);
    setPage(1);
  }

  return (
    <>
      {lowStockProducts.length > 0 && (
        <div className={styles.alert}>
          <AlertTriangle size={16} className={styles.alertIcon} />
          <div>
            <div className={styles.alertTitle}>
              {lowStockProducts.length} producto(s) con stock bajo
            </div>
            <div className={styles.alertDesc}>
              {lowStockProducts.slice(0, 5).map((p) => p.product_name).join(", ")}
              {lowStockProducts.length > 5 ? "…" : ""}
            </div>
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className={styles.searchInput}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className={styles.filterSelect}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className={styles.stockFilters}>
          <button
            onClick={() => toggleStockFilter("low")}
            className={`${styles.stockFilterBtn} ${stockFilter === "low" ? styles.stockFilterActive : ""}`}
          >
            Stock bajo
          </button>
          <button
            onClick={() => toggleStockFilter("out")}
            className={`${styles.stockFilterBtn} ${stockFilter === "out" ? styles.stockFilterActive : ""}`}
          >
            Sin stock
          </button>
        </div>
      </div>

      <InventoryTable
        products={products}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onAdjust={onAdjust}
      />
    </>
  );
}
