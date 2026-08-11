import { useCallback, useEffect, useRef, useState } from "react";
import { salesApi, type SaleReport } from "@/api/sales";
import { cacheClear, cacheGet, cacheSet, cacheKey } from "@/lib/simple-cache";
import { subscribeRealtime } from "@/lib/realtime";
import { rangeStart, rangeEnd, rangeLabel, type Range } from "@/lib/date-range";
import { Header } from "@/components/pages/reports/Header";
import { ReportStats } from "@/components/pages/reports/ReportStats";
import { CashCloseCard } from "@/components/pages/reports/CashCloseCard";
import { TopProductsCard } from "@/components/pages/reports/TopProductsCard";
import { ChartsSection } from "@/components/pages/reports/ChartsSection";
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

  // Contador de secuencia: descarta respuestas obsoletas (mismo guard que el hook).
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (r: Range, silent = false) => {
    const start = rangeStart(r).toISOString();
    const end = rangeEnd(r).toISOString();
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
        salesApi.report({ start_date: prev.start.toISOString(), end_date: prev.end.toISOString() }),
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
      <Header range={range} onRangeChange={setRange} />

      <ReportStats report={report} prevReport={prevReport} />

      <ChartsSection report={report} range={range} />

      <div className={styles.twoCol}>
        <CashCloseCard report={report} rangeLabel={rangeLabel(range)} />
        <TopProductsCard report={report} />
      </div>
    </div>
  );
}
