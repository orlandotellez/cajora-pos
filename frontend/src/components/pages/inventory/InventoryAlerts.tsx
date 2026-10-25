import { AlertTriangle, PackagePlus, PackageX } from "lucide-react";
import type { LowStockProduct } from "@/api/inventory";
import styles from "./InventoryAlerts.module.css";

interface InventoryAlertsProps {
  alerts: LowStockProduct[];
  onAdjust: (productId: string) => void;
}

export function InventoryAlerts({ alerts, onAdjust }: InventoryAlertsProps) {
  const outOfStock = alerts.filter((a) => a.current_stock <= 0);
  const lowStock = alerts.filter((a) => a.current_stock > 0);

  if (alerts.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyTitle}>Sin alertas</span>
        <span className={styles.emptyDesc}>Todo el stock está en orden.</span>
      </div>
    );
  }

  function renderList(items: LowStockProduct[]) {
    return (
      <div className={styles.list}>
        {items.map((a) => (
          <article key={a.product_id} className={styles.card}>
            <div className={styles.info}>
              <span className={styles.name}>{a.product_name}</span>
              <span className={styles.meta}>
                Stock: {a.current_stock} · Mínimo: {a.low_stock_threshold}
              </span>
            </div>
            <button
              type="button"
              className={styles.action}
              onClick={() => onAdjust(a.product_id)}
            >
              <PackagePlus size={14} /> Ajustar
            </button>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {outOfStock.length > 0 && (
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.titleOut}`}>
            <PackageX size={16} />
            Sin stock ({outOfStock.length})
          </h2>
          {renderList(outOfStock)}
        </section>
      )}

      {lowStock.length > 0 && (
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.titleLow}`}>
            <AlertTriangle size={16} />
            Stock bajo ({lowStock.length})
          </h2>
          {renderList(lowStock)}
        </section>
      )}
    </div>
  );
}
