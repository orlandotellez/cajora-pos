import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { salesApi, type Sale, type SaleReport } from "@/api/sales";
import { money } from "@/lib/format";
import { cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import TableSkeleton from "@/components/common/TableSkeleton";
import { ReportStats } from "@/components/pages/reports/ReportStats";
import { CashCloseCard } from "@/components/pages/reports/CashCloseCard";
import { TopProductsCard } from "@/components/pages/reports/TopProductsCard";
import { ChartsSection } from "@/components/pages/reports/ChartsSection";
import { PAGE_LIMIT as SALES_LIMIT } from "@/lib/constants";
import styles from "./Reports.module.css";

type Range = "today" | "week" | "month";

function rangeStart(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (r === "week") { d.setDate(d.getDate() - 7); return d; }
  d.setDate(d.getDate() - 30);
  return d;
}

function rangeEnd(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(23, 59, 59, 999); return d; }
  return d;
}

const SKELETON_COLS = [
  { width: "50%" },
  { width: "30%" },
  { width: "20%", align: "right" as const },
];

export default function Reports() {
  const [range, setRange] = useState<Range>("today");
  const [report, setReport] = useState<SaleReport | null>(() => {
    const cached = cacheGet<{ report: SaleReport; sales: Sale[] }>(cacheKey("reports", "today"));
    return cached?.report ?? null;
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const cached = cacheGet<{ report: SaleReport; sales: Sale[] }>(cacheKey("reports", "today"));
    return cached?.sales ?? [];
  });
  const [loading, setLoading] = useState(true);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);

  const salesTotalPages = Math.max(1, Math.ceil(salesTotal / SALES_LIMIT));

  useEffect(() => {
    const start = rangeStart(range).toISOString();
    const end = rangeEnd(range).toISOString();
    const key = cacheKey("reports", range, String(salesPage));
    const cached = cacheGet<{ report: SaleReport; sales: Sale[]; total: number }>(key);

    if (cached) { setReport(cached.report); setSales(cached.sales); setSalesTotal(cached.total); }
    setLoading(!cached);

    Promise.all([
      salesApi.report({ start_date: start, end_date: end }),
      salesApi.list({ start_date: start, end_date: end, page: salesPage, limit: SALES_LIMIT }),
    ])
      .then(([r, list]) => {
        setReport(r);
        setSales(list.sales);
        setSalesTotal(list.total);
        cacheSet(key, { report: r, sales: list.sales, total: list.total });
      })
      .catch((err) => console.error("Error al cargar reportes:", err))
      .finally(() => setLoading(false));
  }, [range, salesPage]);

  useEffect(() => { setSalesPage(1); }, [range]);

  const hasData = report !== null;

  if (loading && !hasData) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.h1}>Reportes</h1>
            <p className={styles.subtitle}>Resumen de ventas y productos</p>
          </div>
          <div className={`${styles.select} ${styles.skeletonBar} ${styles["skeleton-header"]}`} />
        </header>
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.statCard}>
              <div className={`${styles.skeletonBar} ${styles["skeleton-stat-up"]}`} />
              <div className={`${styles.skeletonBar} ${styles["skeleton-stat-down"]}`} />
            </div>
          ))}
        </div>
        <div className={styles.twoCol}>
          <div className={styles.card}>
            <div className={`${styles.skeletonBar} ${styles["skeleton-card-title"]}`} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonBar} ${styles["skeleton-card-line"]}`} />
            ))}
          </div>
          <div className={styles.card}>
            <div className={styles.skeletonBar} style={{ width: "50%", height: 16, marginBottom: 16 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.skeletonBar} style={{ width: `${50 + i * 8}%`, height: 14, marginBottom: 8 }} />
            ))}
          </div>
        </div>
        <div className={styles.recentCard}>
          <div className={`${styles.skeletonBar} ${styles["skeleton-recent-title"]}`} />
          <div className={styles.tableWrapper}><table className={styles.table}>
            <thead><tr><th>Fecha</th><th>Método</th><th>Total</th></tr></thead>
            <tbody><TableSkeleton cols={SKELETON_COLS} rows={5} /></tbody>
          </table></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Reportes</h1>
          <p className={styles.subtitle}>Resumen de ventas y productos</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)} className={styles.select}>
          <option value="today">Hoy</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Últimos 30 días</option>
        </select>
      </header>

      <ReportStats report={report} />

      <ChartsSection report={report} />

      <div className={styles.twoCol}>
        <CashCloseCard
          report={report}
          rangeLabel={range === "today" ? "hoy" : range === "week" ? "7 días" : "30 días"}
        />
        <TopProductsCard report={report} />
      </div>

      <section className={styles.recentCard}>
        <h2 className={styles.recentTitle}>Últimas ventas</h2>
        <div className={styles.tableWrapper}><table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Fecha</th>
              <th className={styles.thLeft}>Método</th>
              <th className={styles.thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.map((s) => (
                <tr key={s.id} className={`${styles.tr} ${loading ? styles.trDim : ""}`}>
                  <td className={styles.tdDate}>{new Date(s.created_at).toLocaleString("es-MX")}</td>
                  <td className={styles.tdMethod}>{s.payment_method}</td>
                  <td className={styles.tdRight}>{money(s.total)}</td>
                </tr>
              ))
            ) : loading ? (
              <TableSkeleton cols={SKELETON_COLS} rows={5} />
            ) : (
              <tr><td colSpan={3} className={styles.empty}>Sin ventas</td></tr>
            )}
          </tbody>
        </table></div>

        {salesTotalPages > 1 && (
          <div className={styles.pagination}>
            <button onClick={() => setSalesPage((p) => Math.max(1, p - 1))} disabled={salesPage <= 1} className={styles.pageBtn}>
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: salesTotalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setSalesPage(n)} className={`${styles.pageBtn} ${n === salesPage ? styles.pageActive : ""}`}>{n}</button>
            ))}
            <button onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))} disabled={salesPage >= salesTotalPages} className={styles.pageBtn}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
