import { useEffect, useState } from "react";
import { salesApi, type Sale, type SaleReport } from "@/api/sales";
import { cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { Header, type Range } from "@/components/pages/reports/Header";
import { ReportStats } from "@/components/pages/reports/ReportStats";
import { CashCloseCard } from "@/components/pages/reports/CashCloseCard";
import { TopProductsCard } from "@/components/pages/reports/TopProductsCard";
import { ChartsSection } from "@/components/pages/reports/ChartsSection";
import { RecentSalesTable } from "@/components/pages/reports/RecentSalesTable";
import { ReportsSkeleton } from "@/components/pages/reports/ReportsSkeleton";
import { PAGE_LIMIT as SALES_LIMIT } from "@/lib/constants";
import styles from "./Reports.module.css";

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
        <ReportsSkeleton range={range} onRangeChange={setRange} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header range={range} onRangeChange={setRange} />

      <ReportStats report={report} />

      <ChartsSection report={report} />

      <div className={styles.twoCol}>
        <CashCloseCard
          report={report}
          rangeLabel={range === "today" ? "hoy" : range === "week" ? "7 días" : "30 días"}
        />
        <TopProductsCard report={report} />
      </div>

      <RecentSalesTable
        sales={sales}
        loading={loading}
        page={salesPage}
        totalPages={salesTotalPages}
        onPageChange={setSalesPage}
      />
    </div>
  );
}
