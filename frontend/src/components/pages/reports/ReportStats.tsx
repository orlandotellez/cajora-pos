import { money } from "@/lib/format";
import type { SaleReport } from "@/api";
import styles from "./ReportStats.module.css";

interface ReportStatsProps {
  report: SaleReport | null;
  prevReport: SaleReport | null;
}

function deltaPercent(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? null : 0; // null = sin referencia previa
  return ((cur - prev) / prev) * 100;
}

export function ReportStats({ report, prevReport }: ReportStatsProps) {
  const bm = report?.sales_by_payment_method ?? {};
  const prevBm = prevReport?.sales_by_payment_method ?? {};

  const stats = [
    {
      label: "Ventas",
      value: money(report?.total_revenue ?? 0),
      cur: report?.total_revenue ?? 0,
      prev: prevReport?.total_revenue ?? 0,
    },
    {
      label: "Transacciones",
      value: String(report?.total_sales ?? 0),
      cur: report?.total_sales ?? 0,
      prev: prevReport?.total_sales ?? 0,
    },
    {
      label: "Ticket promedio",
      value: money(report?.average_ticket ?? 0),
      cur: report?.average_ticket ?? 0,
      prev: prevReport?.average_ticket ?? 0,
    },
    {
      label: "Efectivo",
      value: money((bm as Record<string, number>).efectivo ?? 0),
      cur: (bm as Record<string, number>).efectivo ?? 0,
      prev: (prevBm as Record<string, number>).efectivo ?? 0,
    },
  ];

  return (
    <div className={styles["stats-grid"]}>
      {stats.map((s) => {
        const d = deltaPercent(s.cur, s.prev);
        return (
          <div key={s.label} className={styles["stats-card"]}>
            <div className={styles["stats-label"]}>{s.label}</div>
            <div className={styles["stats-value"]}>{s.value}</div>
            <div className={styles["stats-delta"]}>
              {d === null ? (
                <span className={styles["stats-delta-neutral"]}>— vs anterior</span>
              ) : d === 0 ? (
                <span className={styles["stats-delta-neutral"]}>Sin cambio</span>
              ) : d > 0 ? (
                <span className={styles["stats-delta-up"]}>▲ {d.toFixed(1)}% vs anterior</span>
              ) : (
                <span className={styles["stats-delta-down"]}>▼ {Math.abs(d).toFixed(1)}% vs anterior</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
