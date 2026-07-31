import { money } from "@/lib/format";
import type { SaleReport } from "@/api";
import styles from "./TopProductsCard.module.css";

interface TopProductsCardProps {
  report: SaleReport | null;
}

export function TopProductsCard({ report }: TopProductsCardProps) {
  const top = report?.top_products ?? [];

  return (
    <div className={styles["top-products-card"]}>
      <h3 className={styles["top-products-title"]}>Productos más vendidos</h3>
      {top.length === 0 ? (
        <div className={styles["top-products-empty"]}>Sin datos en este período</div>
      ) : (
        <ul className={styles["top-products-list"]}>
          {top.map(p => (
            <li key={p.product_name} className={styles["top-products-item"]}>
              <span className={styles["top-products-name"]}>{p.product_name}</span>
              <span className={styles["top-products-meta"]}>{p.quantity} · {money(p.revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
