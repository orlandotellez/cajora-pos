import { PAYMENT_METHODS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { SaleReport } from "@/api";
import styles from "./CashCloseCard.module.css";

interface CashCloseCardProps {
  report: SaleReport | null;
  rangeLabel: string;
}

export function CashCloseCard({ report, rangeLabel }: CashCloseCardProps) {
  const bm = report?.sales_by_payment_method ?? {};
  const paymentMethods = [...PAYMENT_METHODS];

  return (
    <div className={styles["close-card"]}>
      <h3 className={styles["close-card-title"]}>Cierre de caja — {rangeLabel}</h3>
      <div className={styles["close-card-body"]}>
        {paymentMethods.map(pm => (
          <div key={pm.value} className={styles["close-card-row"]}>
            <span className={styles["close-card-label"]}>{pm.label}</span>
            <span>{money((bm as Record<string, number>)[pm.value] ?? 0)}</span>
          </div>
        ))}
        <div className={styles["close-card-divider"]} />
        <div className={styles["close-card-total-row"]}>
          <span>Total</span>
          <span>{money(report?.total_revenue ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
