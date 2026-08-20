import { Wrench } from "lucide-react";
import type { Product, Service } from "@/api";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { usePosStore } from "@/store/posStore";
import styles from "./PosSearchBar.module.css";

export interface SearchResult {
  _type: "product" | "service";
  id: string;
  name: string;
  barcode?: string;
  unit_type?: string;
  price: number;
  data: Product | Service;
}

interface PosSearchBarProps {
  searchTerm: string;
  showResults: boolean;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchWrapperRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
  onAddToCart: (result: SearchResult) => void;
}

export function PosSearchBar({
  searchTerm,
  showResults,
  searchResults,
  searchLoading,
  searchWrapperRef,
  inputRef,
  onSearchChange,
  onFocus,
  onKeyDown,
  onSubmit,
  onAddToCart,
}: PosSearchBarProps) {
  const currency = usePosStore((s) => s.currency);
  return (
    <div className={styles.searchBar} ref={searchWrapperRef}>
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder="Escanea o escribe código / nombre"
          className={styles.searchInput}
        />
      </form>
      {showResults && searchLoading && searchResults.length === 0 && (
        <div className={styles.searchLoading}>
          <span className={styles.searchLoadingDot}></span>
          <span className={styles.searchLoadingDot}></span>
          <span className={styles.searchLoadingDot}></span>
        </div>
      )}
      {showResults && !searchLoading && searchResults.length > 0 && (
        <div className={styles.searchResults}>
          {searchResults.map((r) => {
            const isOutOfStock = r._type === "product" && (r.data as Product).stock <= 0;
            const isLowStock = r._type === "product" && (r.data as Product).stock > 0 && (r.data as Product).stock <= (r.data as Product).low_stock_threshold;
            return (
              <button
                key={`${r._type}-${r.id}`}
                className={`${styles.searchResultItem} ${isOutOfStock ? styles.searchResultItemDisabled : ""}`}
                onClick={() => !isOutOfStock && onAddToCart(r)}
                disabled={isOutOfStock}
              >
                <div className={styles.searchResultLeft}>
                  <span className={styles.searchResultName}>
                    {r._type === "service" && <Wrench size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle", opacity: 0.6 }} />}
                    {r.name}
                  </span>
                  {r.barcode && <span className={styles.searchResultCode}>{r.barcode}</span>}
                  {r._type === "product" && r.unit_type && <span className={styles.unitTag}>{UNIT_TYPE_LABELS[r.unit_type] || r.unit_type}</span>}
                  {r._type === "product" && isOutOfStock && <span className={styles.searchResultCode}>Sin stock</span>}
                  {r._type === "product" && isLowStock && <span className={styles.searchResultCodeLowStock}>Stock bajo</span>}
                  {r._type === "service" && <span className={styles.searchResultCode}>Servicio</span>}
                </div>
                <span className={styles.searchResultPrice}>{money(r.price, currency)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
