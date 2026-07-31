import { money } from "@/lib/format";
import type { SaleReport } from "@/api";
import styles from "./ReportStats.module.css";

interface ReportStatsProps {
  report: SaleReport | null;
}

export function ReportStats({ report }: ReportStatsProps) {
  const bm = report?.sales_by_payment_method ?? {};
  const stats = [
    { label: "Ventas", value: money(report?.total_revenue ?? 0) },
    { label: "Transacciones", value: String(report?.total_sales ?? 0) },
    { label: "Ticket promedio", value: money(report?.average_ticket ?? 0) },
    { label: "Efectivo", value: money(bm.efectivo ?? 0) },
  ];

  return (
    <div className={styles["stats-grid"]}>
      {stats.map((s) => (
        <div key={s.label} className={styles["stats-card"]}>
          <div className={styles["stats-label"]}>{s.label}</div>
          <div className={styles["stats-value"]}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
