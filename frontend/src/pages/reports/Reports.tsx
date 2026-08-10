import { useCallback, useEffect, useRef, useState } from "react";
import { salesApi, type Sale, type SaleReport } from "@/api/sales";
import { cacheClear, cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { subscribeRealtime } from "@/lib/realtime";
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
  const [refreshing, setRefreshing] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);

  const salesTotalPages = Math.max(1, Math.ceil(salesTotal / SALES_LIMIT));

  // Contador de secuencia: descarta respuestas obsoletas (mismo guard que el hook).
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (r: Range, sp: number, silent = false) => {
    const start = rangeStart(r).toISOString();
    const end = rangeEnd(r).toISOString();
    const key = cacheKey("reports", r, String(sp));
    const seq = ++loadSeqRef.current;
    const cached = cacheGet<{ report: SaleReport; sales: Sale[]; total: number }>(key);

    if (cached) {
      if (seq !== loadSeqRef.current) return; // respuesta obsoleta
      setReport(cached.report); setSales(cached.sales); setSalesTotal(cached.total);
    }
    if (!silent) setLoading(!cached);

    try {
      const [rep, list] = await Promise.all([
        salesApi.report({ start_date: start, end_date: end }),
        salesApi.list({ start_date: start, end_date: end, page: sp, limit: SALES_LIMIT }),
      ]);
      if (seq !== loadSeqRef.current) return; // respuesta obsoleta
      setReport(rep);
      setSales(list.sales);
      setSalesTotal(list.total);
      cacheSet(key, { report: rep, sales: list.sales, total: list.total });
    } catch (err) {
      console.error("Error al cargar reportes:", err);
    } finally {
      if (!silent && seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(range, salesPage);
  }, [range, salesPage, loadData]);

  // Polling silencioso: mantiene el reporte fresco cuando otro usuario registra
  // ventas. Bypass del cache, se pausa con la pestaña oculta y refresca al
  // instante al volver a ser visible.
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  // Tiempo real: si otro cajero registra una venta, refrescar el reporte al
  // instante (el polling de 60s queda como respaldo si el SSE falla).
  const rangeRef = useRef(range);
  const salesPageRef = useRef(salesPage);
  useEffect(() => { rangeRef.current = range; }, [range]);
  useEffect(() => { salesPageRef.current = salesPage; }, [salesPage]);

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (event !== "sale.created") return;
      cacheClear("reports");
      setRefreshing(true);
      void loadDataRef.current(rangeRef.current, salesPageRef.current, true)
        .finally(() => setRefreshing(false));
    });
  }, []);

  useEffect(() => {
    let inFlight = false;
    const tick = () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      cacheClear("reports");
      void loadDataRef.current(range, salesPage, true).finally(() => { inFlight = false; });
    };

    const intervalId = window.setInterval(tick, 10_000);
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
        refreshing={refreshing}
        page={salesPage}
        totalPages={salesTotalPages}
        onPageChange={setSalesPage}
      />
    </div>
  );
}
