import { useCallback, useEffect, useRef, useState } from "react";
import { salesApi, type SaleReport } from "@/api/sales";
import { cacheClear, cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { subscribeRealtime } from "@/lib/realtime";
import { rangeStart, rangeEnd, rangeLabel, toLocalISOString, type Range } from "@/lib/date-range";
import { exportReportsToExcel } from "@/lib/report-export";
import { Header } from "@/components/pages/reports/Header";
import { ReportStats } from "@/components/pages/reports/ReportStats";
import { ChartsSection } from "@/components/pages/reports/ChartsSection";
import { TopProducts } from "@/components/pages/reports/TopProducts";
import { ProductPerformance } from "@/components/pages/reports/ProductPerformance";
import { ReportsSkeleton } from "@/components/pages/reports/ReportsSkeleton";
import styles from "./Reports.module.css";

// Periodo inmediatamente anterior de igual duración (para la comparativa).
function prevRange(r: Range) {
  const start = rangeStart(r);
  const end = rangeEnd(r);
  const span = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - span),
    end: new Date(end.getTime() - span),
  };
}

const POLL_INTERVAL_MS = 60_000;

export default function Reports() {
  const [range, setRange] = useState<Range>("today");
  const [report, setReport] = useState<SaleReport | null>(() => {
    const cached = cacheGet<{ report: SaleReport; prevReport: SaleReport | null }>(
      cacheKey("reports", "today"),
    );
    return cached?.report ?? null;
  });
  const [prevReport, setPrevReport] = useState<SaleReport | null>(() => {
    const cached = cacheGet<{ report: SaleReport; prevReport: SaleReport | null }>(
      cacheKey("reports", "today"),
    );
    return cached?.prevReport ?? null;
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Descarga el .xlsx con el detalle del rango actual.
  const handleExport = useCallback(async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      await exportReportsToExcel(range, report);
    } catch (err) {
      console.error("Error al exportar a Excel:", err);
    } finally {
      setExporting(false);
    }
  }, [range, report, exporting]);

  // Contador de secuencia: descarta respuestas obsoletas (mismo guard que el hook).
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (r: Range, silent = false) => {
    const start = toLocalISOString(rangeStart(r));
    const end = toLocalISOString(rangeEnd(r));
    const prev = prevRange(r);
    const key = cacheKey("reports", r);
    const seq = ++loadSeqRef.current;
    const cached = cacheGet<{ report: SaleReport; prevReport: SaleReport | null }>(key);

    if (cached) {
      if (seq !== loadSeqRef.current) return; // respuesta obsoleta
      setReport(cached.report);
      setPrevReport(cached.prevReport);
    }
    if (!silent) setLoading(!cached);

    try {
      const [rep, prevRep] = await Promise.all([
        salesApi.report({ start_date: start, end_date: end }),
        salesApi.report({ start_date: toLocalISOString(prev.start), end_date: toLocalISOString(prev.end) }),
      ]);
      if (seq !== loadSeqRef.current) return; // respuesta obsoleta
      setReport(rep);
      setPrevReport(prevRep);
      cacheSet(key, { report: rep, prevReport: prevRep });
    } catch (err) {
      console.error("Error al cargar reportes:", err);
    } finally {
      if (!silent && seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(range);
  }, [range, loadData]);

  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  const rangeRef = useRef(range);
  useEffect(() => { rangeRef.current = range; }, [range]);

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (event !== "sale.created") return;
      cacheClear("reports");
      void loadDataRef.current(rangeRef.current, true);
    });
  }, []);

  useEffect(() => {
    let inFlight = false;
    const tick = () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      cacheClear("reports");
      void loadDataRef.current(range, true).finally(() => { inFlight = false; });
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [range]);

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
      <Header range={range} onRangeChange={setRange} onExport={handleExport} exporting={exporting} />

      <ReportStats report={report} prevReport={prevReport} />

      <ChartsSection report={report} range={range} />

      <div style={{ marginBottom: 24 }}>
        <TopProducts report={report} />
      </div>

      <ProductPerformance range={range} />
    </div>
  );
}
