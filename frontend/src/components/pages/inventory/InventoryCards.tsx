import { PackagePlus, Pencil } from "lucide-react";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS, unitQuantitySuffix } from "@/lib/constants";
import { getVisiblePages } from "@/lib/pagination";
import { RefreshBadge } from "@/components/common/RefreshBadge";
import type { Product } from "@/api";
import { ProductThumb } from "@/components/common/ProductThumb";
import styles from "./InventoryCards.module.css";

interface InventoryCardsProps {
  products: Product[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onRowClick?: (product: Product) => void;
  refreshing?: boolean;
}

export function InventoryCards({
  products,
  loading,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onAdjust,
  onRowClick,
  refreshing,
}: InventoryCardsProps) {
  return (
    <div className={styles.wrapper}>
      <RefreshBadge refreshing={refreshing} />

      {loading && products.length === 0 ? (
        <div className={styles.list} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className={styles.empty}>Sin productos</p>
      ) : (
        <div className={styles.list}>
          {products.map((p) => {
            const outOfStock = p.stock <= 0;
            const lowStock = !outOfStock && p.stock <= p.low_stock_threshold;
            return (
              <article key={p.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => onRowClick?.(p)}
                  aria-label={`Ver ${p.name}`}
                >
                  <span className={styles.infoRow}>
                    <ProductThumb size={44} />
                    <span className={styles.info}>
                      <span className={styles.name}>{p.name}</span>
                      {p.barcode && <span className={styles.barcode}>{p.barcode}</span>}
                    </span>
                  </span>
                  <span
                    className={`${styles.stock} ${outOfStock ? styles.stockOut : lowStock ? styles.stockLow : ""}`}
                  >
                    {p.stock}
                    {p.unit_type && (
                      <span className={styles.unit}>
                        {UNIT_TYPE_LABELS[p.unit_type] || p.unit_type}
                        {unitQuantitySuffix(p.unit_type, p.unit_quantity)}
                      </span>
                    )}
                  </span>
                </button>

                <div className={styles.footer}>
                  <span className={styles.price}>{money(p.price)}</span>
                  <div className={styles.actions}>
                    <button type="button" className={styles.action} onClick={() => onAdjust(p)}>
                      <PackagePlus size={14} /> Ajustar
                    </button>
                    <button type="button" className={styles.action} onClick={() => onEdit(p)}>
                      <Pencil size={14} /> Editar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={styles.pageBtn}
          >
            Anterior
          </button>
          {getVisiblePages(page, totalPages).map((item, idx) =>
            item === "dots" ? (
              <span key={`dots-${idx}`} className={styles.paginationDots}>
                …
              </span>
            ) : (
              <button
                type="button"
                key={item}
                onClick={() => onPageChange(item)}
                className={`${styles.pageBtn} ${item === page ? styles.pageActive : ""}`}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={styles.pageBtn}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
