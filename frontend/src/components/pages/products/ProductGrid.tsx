import { Check, Plus } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { money } from "@/lib/format";
import { getVisiblePages } from "@/lib/pagination";
import { RefreshBadge } from "@/components/common/RefreshBadge";
import type { Product } from "@/api";
import styles from "./ProductGrid.module.css";

const COVER_COLORS = [
  "#a04a44",
  "#46525f",
  "#6a5a9c",
  "#a96a3f",
  "#7a5636",
  "#953c46",
  "#8a7136",
  "#8c6136",
  "#8b4460",
];

const UNIT_SHORT: Record<string, string> = {
  unidad: "u",
  libra: "lb",
  paquete: "paq",
  caja: "cja",
  bolsa: "bolsa",
  botella: "bot",
  lata: "lata",
  sobre: "sobre",
  barra: "barra",
  rollo: "rollo",
  galon: "gal",
  ristra: "ristra",
};

function coverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COVER_COLORS[hash % COVER_COLORS.length];
}

function unitLabel(unitType?: string | null): string {
  if (!unitType) return "u";
  return UNIT_SHORT[unitType] ?? unitType.slice(0, 3);
}

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onProductClick: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onProductLongPress?: (product: Product) => void;
  refreshing?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

interface ProductCardProps {
  product: Product;
  selected: boolean;
  selectable: boolean;
  onActivate: (product: Product) => void;
  onAdd?: (product: Product) => void;
  onLongPress: (product: Product) => void;
}

function ProductCard({
  product: p,
  selected,
  selectable,
  onActivate,
  onAdd,
  onLongPress,
}: ProductCardProps) {
  const longPress = useLongPress(() => onLongPress(p));

  function activate() {
    if (longPress.consumeClick()) return;
    onActivate(p);
  }

  const outOfStock = p.stock <= 0;
  const lowStock = !outOfStock && p.stock <= p.low_stock_threshold;

  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onContextMenu={longPress.onContextMenu}
    >
      <div className={styles.cover} style={{ background: coverColor(p.id) }}>
        <button
          type="button"
          className={styles.coverTap}
          onClick={activate}
          aria-label={selectable ? `Seleccionar ${p.name}` : `Ver ${p.name}`}
        />
        <span className={styles.coverName}>{p.name}</span>
        <span
          className={`${styles.stock} ${outOfStock ? styles.stockOut : lowStock ? styles.stockLow : ""}`}
        >
          {p.stock} {unitLabel(p.unit_type)}
        </span>
        {selectable && (
          <span className={`${styles.check} ${selected ? styles.checkOn : ""}`}>
            {selected && <Check size={14} strokeWidth={3} />}
          </span>
        )}
      </div>

      <button
        type="button"
        className={styles.bodyTap}
        onClick={activate}
        aria-label={selectable ? `Seleccionar ${p.name}` : `Ver ${p.name}`}
      >
        <span className={styles.name}>{p.name}</span>
        <span className={styles.price}>{money(p.price)}</span>
      </button>

      {!selectable && (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onAdd?.(p)}
          disabled={outOfStock}
          title={outOfStock ? "Sin stock" : "Agregar a la lista de venta"}
          aria-label={`Agregar ${p.name} a la lista de venta`}
        >
          <Plus size={16} strokeWidth={3} />
          {outOfStock ? "Sin stock" : "Agregar"}
        </button>
      )}
    </article>
  );
}

export function ProductGrid({
  products,
  loading,
  page,
  totalPages,
  onPageChange,
  onProductClick,
  onAddToCart,
  onProductLongPress,
  refreshing,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: ProductGridProps) {
  const pageIds = products.map((p) => p.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));

  function toggleOne(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleAll() {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  }

  return (
    <div className={styles.wrapper}>
      <RefreshBadge refreshing={refreshing} />

      {selectable && products.length > 0 && (
        <label className={styles.selectAll}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>Seleccionar todos ({products.length})</span>
        </label>
      )}

      {loading && products.length === 0 ? (
        <div className={styles.grid} aria-busy="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className={styles.empty}>Sin productos</p>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              selected={selectedIds?.has(p.id) ?? false}
              selectable={selectable}
              onActivate={(prod) => (selectable ? toggleOne(prod.id) : onProductClick(prod))}
              onAdd={onAddToCart}
              onLongPress={(prod) => onProductLongPress?.(prod)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationButtons}>
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
        </div>
      )}
    </div>
  );
}
