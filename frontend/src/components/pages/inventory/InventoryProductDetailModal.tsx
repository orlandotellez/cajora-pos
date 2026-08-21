import { X, Pencil, PackagePlus } from "lucide-react";
import type { Product } from "@/api";
import { UNIT_TYPE_LABELS, needsUnitQuantity, costUnitNoun } from "@/lib/constants";
import { money } from "@/lib/format";
import styles from "./InventoryProductDetailModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface InventoryProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
}

export function InventoryProductDetailModal({ product, onClose, onEdit, onAdjust }: InventoryProductDetailModalProps) {
  useModalBack(onClose);

  const margin = product.price - product.cost;
  const marginPct = product.price > 0 ? (margin / product.price) * 100 : 0;
  const hasCost = product.cost > 0;
  const lowStock = product.stock <= product.low_stock_threshold;
  const outOfStock = product.stock <= 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalle del producto</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.productHeader}>
            <div className={styles.productName}>{product.name}</div>
            {product.barcode && <div className={styles.productBarcode}>{product.barcode}</div>}
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Datos generales</h3>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Tipo de empaque</span>
                <span className={styles.detailValue}>
                  {product.unit_type
                    ? UNIT_TYPE_LABELS[product.unit_type] || product.unit_type
                    : "—"}
                </span>
              </div>
              {needsUnitQuantity(product.unit_type) && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Cant. x empaque</span>
                  <span className={styles.detailValue}>{product.unit_quantity ?? "—"}</span>
                </div>
              )}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Categoría</span>
                <span className={styles.detailValue}>{product.category?.name || "—"}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Proveedor</span>
                <span className={styles.detailValue}>{product.supplier?.name || "—"}</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Control comercial</h3>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Precio venta</span>
                <span className={`${styles.detailValue} ${styles.moneyValue}`}>{money(product.price)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  {costUnitNoun(product.unit_type) === "unidad"
                    ? "Costo"
                    : `Costo por ${costUnitNoun(product.unit_type)}`}
                </span>
                <span className={`${styles.detailValue} ${styles.moneyValue}`}>{money(product.cost)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Margen</span>
                <span className={`${styles.detailValue} ${styles.moneyValue} ${hasCost && margin < 0 ? styles.negative : ""}`}>
                  {hasCost ? `${money(margin)} (${marginPct.toFixed(1)}%)` : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Stock</span>
                <span
                  className={`${styles.detailValue} ${styles.stockValue}`}
                  style={{ color: outOfStock ? "#ef4444" : lowStock ? "#f59e0b" : undefined }}
                >
                  {product.stock}
                  {outOfStock ? " · sin stock" : lowStock ? " · stock bajo" : ""}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Alerta stock bajo</span>
                <span className={styles.detailValue}>{product.low_stock_threshold}</span>
              </div>
            </div>
            {!hasCost && (
              <p className={styles.marginHint}>
                Cargá el costo para ver el margen de este producto.
              </p>
            )}
          </section>
        </div>

        <div className={styles.modalActions}>
          <button onClick={() => onAdjust(product)} className={styles.outlineBtn}>
            <PackagePlus size={15} />
            Ajustar stock
          </button>
          <button onClick={() => onEdit(product)} className={styles.primaryBtn}>
            <Pencil size={15} />
            Editar producto
          </button>
        </div>
      </div>
    </div>
  );
}
