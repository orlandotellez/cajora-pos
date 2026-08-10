import { useEffect, useRef, useState } from "react";
import { salesApi, type Sale } from "@/api/sales";
import { printersApi } from "@/api/printers";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PAGE_LIMIT as LIMIT } from "@/lib/constants";
import { SaleTable } from "@/components/pages/sales/SaleTable";
import styles from "./Sales.module.css";
import { cacheClear, cacheGet, cacheKey, cacheSet } from "@/lib/simple-cache";
import { openSalesEvents } from "@/lib/sales-events";
import { Header } from "@/components/pages/sales/Header";
import { Filter } from "@/components/pages/sales/Filter";
import { PrinterSaleModal } from "@/components/pages/sales/PrinterSaleModal";
import { PrinterLoad } from "@/components/common/PrinterLoad";

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [userNameFilter, setUserNameFilter] = useState("");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [minItemsFilter, setMinItemsFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [printing, setPrinting] = useState(false);
  const [hasPrinter, setHasPrinter] = useState(true);

  useEffect(() => {
    printersApi.list().then((res) => {
      setHasPrinter(res.printers.some((p) => p.is_default && p.is_active && p.connection_type === "net"));
    }).catch(() => setHasPrinter(false));
  }, []);
  const { storeName, storeAddress, storePhone, storeFooter } = useStoreSettings();

  const [debouncedUserName, flushUserName] = useDebouncedValue(userNameFilter, 300);
  const [debouncedMinQty, flushMinQty] = useDebouncedValue(minQtyFilter, 300);
  const [debouncedMinItems, flushMinItems] = useDebouncedValue(minItemsFilter, 300);

  const trimmedUser = debouncedUserName.trim();
  const trimmedQtyStr = debouncedMinQty.trim();
  const trimmedItemsStr = debouncedMinItems.trim();
  const minQtyNum = trimmedQtyStr ? Math.max(1, Math.floor(Number(trimmedQtyStr))) : 0;
  const minItemsNum = trimmedItemsStr ? Math.max(1, Math.floor(Number(trimmedItemsStr))) : 0;

  // Contador de secuencia: descarta respuestas obsoletas (mismo guard que el hook).
  const fetchSeqRef = useRef(0);

  const fetchSales = async (p: number, silent = false) => {
    const key = cacheKey("sales", p, startDate, endDate, paymentFilter, trimmedUser, minQtyNum, minItemsNum);
    const seq = ++fetchSeqRef.current;
    const cached = cacheGet<{ sales: Sale[]; total: number }>(key);
    if (cached) {
      if (seq !== fetchSeqRef.current) return; // respuesta obsoleta
      setSales(cached.sales);
      setTotal(cached.total);
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await salesApi.list({
        page: p, limit: LIMIT,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_method: paymentFilter || undefined,
        q: trimmedUser || undefined,
        min_total_qty: minQtyNum > 0 ? minQtyNum : undefined,
        min_items_count: minItemsNum > 0 ? minItemsNum : undefined,
      });
      if (seq !== fetchSeqRef.current) return; // respuesta obsoleta
      setSales(res.sales);
      setTotal(res.total);
      cacheSet(key, { sales: res.sales, total: res.total });
    } catch (err) { console.warn("Error al cargar ventas:", err); }
    finally { if (!silent && seq === fetchSeqRef.current) setLoading(false); }
  };

  // Polling silencioso: refresca la tabla cuando otro usuario registra ventas.
  // Siempre lee del server (bypass del cache), se pausa con la pestaña oculta
  // y al volver a ser visible refresca al instante.
  const fetchSalesRef = useRef(fetchSales);
  useEffect(() => { fetchSalesRef.current = fetchSales; }, [fetchSales]);

  // Tiempo real: cuando el backend emite `sale.created` (otro cajero vendió),
  // invalidar el cache y refrescar la tabla al instante.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  useEffect(() => {
    const close = openSalesEvents(() => {
      cacheClear("sales");
      void fetchSalesRef.current(pageRef.current, true);
    });
    return close;
  }, []);

  // Refresco manual (botón): trae datos nuevos del server, ignorando el cache.
  // (fetchSales maneja sus propios errores internamente y nunca lanza.)
  function handleRefresh() {
    setRefreshing(true);
    cacheClear("sales");
    void fetchSales(page, true).finally(() => setRefreshing(false));
  }

  useEffect(() => {
    let inFlight = false;
    const tick = () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      cacheClear("sales");
      void fetchSalesRef.current(page, true).finally(() => { inFlight = false; });
    };

    // Respaldo al SSE: 20s (antes 60s) para que la actualización automática se
    // note aunque el streaming falle por CORS/red en algún entorno.
    const intervalId = window.setInterval(tick, 20_000);
    const onVisibilityChange = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [page]);

  useEffect(() => {
    fetchSales(1);
    setPage(1);
  }, [startDate, endDate, paymentFilter, debouncedUserName, debouncedMinQty, debouncedMinItems]);

  useEffect(() => {
    if (page > 1) fetchSales(page);
  }, [page]);

  const hasActiveFilters = Boolean(
    startDate || endDate || paymentFilter || userNameFilter || minQtyFilter || minItemsFilter
  );

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setPaymentFilter("");
    setUserNameFilter("");
    setMinQtyFilter("");
    setMinItemsFilter("");
    flushUserName("");
    flushMinQty("");
    flushMinItems("");
    setPage(1);
  }

  function openDetails(sale: Sale) {
    if (!sale.items || sale.items.length === 0) {
      salesApi.getById(sale.id).then(setSelected).catch((err) => console.warn("Error al cargar venta:", err));
    } else {
      setSelected(sale);
    }
  }

  return (
    <div className={styles.page}>
      <Header total={total} refreshing={refreshing} onRefresh={handleRefresh} />

      <Filter
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        userNameFilter={userNameFilter}
        setUserNameFilter={setUserNameFilter}
        minQtyFilter={minQtyFilter}
        setMinQtyFilter={setMinQtyFilter}
        minItemsFilter={minItemsFilter}
        setMinItemsFilter={setMinItemsFilter}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
      />

      <SaleTable
        sales={sales}
        loading={loading}
        total={total}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / LIMIT))}
        onPageChange={setPage}
        onView={openDetails}
        dimmed={false}
      />

      {selected && (
        <PrinterSaleModal
          selected={selected}
          setSelected={() => setSelected(null)}
          setPrinting={setPrinting}
          printing={printing}
          hasPrinter={hasPrinter}
          storeName={storeName}
          storeAddress={storeAddress}
          storePhone={storePhone}
          storeFooter={storeFooter}
        />
      )}

      {printing && <PrinterLoad />}
    </div>
  );
}
