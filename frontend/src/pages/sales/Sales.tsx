import { useCallback, useEffect, useRef, useState } from "react";
import { salesApi, type Sale } from "@/api/sales";
import { printersApi } from "@/api/printers";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { PAGE_LIMIT as LIMIT } from "@/lib/constants";
import { SaleTable } from "@/components/pages/sales/SaleTable";
import styles from "./Sales.module.css";
import { cacheGet, cacheKey, cacheSet } from "@/lib/simple-cache";
import { Header } from "@/components/pages/sales/Header";
import { Filter } from "@/components/pages/sales/Filter";
import { PrinterSaleModal } from "@/components/pages/sales/PrinterSaleModal";
import { PrinterLoad } from "@/components/common/PrinterLoad";

function useDebounced<T>(value: T, ms: number): readonly [T, (v: T) => void] {
  const [v, setV] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setV(value), ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, ms]);

  const flush = useCallback((newValue: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setV(newValue);
  }, []);

  return [v, flush] as const;
}

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
  const [selected, setSelected] = useState<Sale | null>(null);
  const [printing, setPrinting] = useState(false);
  const [hasPrinter, setHasPrinter] = useState(true);

  useEffect(() => {
    printersApi.list().then((res) => {
      setHasPrinter(res.printers.some((p) => p.is_default && p.is_active && p.connection_type === "net"));
    }).catch(() => setHasPrinter(false));
  }, []);
  const { storeName, storeAddress, storePhone, storeFooter } = useStoreSettings();

  const [debouncedUserName, flushUserName] = useDebounced(userNameFilter, 300);
  const [debouncedMinQty, flushMinQty] = useDebounced(minQtyFilter, 300);
  const [debouncedMinItems, flushMinItems] = useDebounced(minItemsFilter, 300);

  const trimmedUser = debouncedUserName.trim();
  const trimmedQtyStr = debouncedMinQty.trim();
  const trimmedItemsStr = debouncedMinItems.trim();
  const minQtyNum = trimmedQtyStr ? Math.max(1, Math.floor(Number(trimmedQtyStr))) : 0;
  const minItemsNum = trimmedItemsStr ? Math.max(1, Math.floor(Number(trimmedItemsStr))) : 0;

  const fetchSales = async (p: number) => {
    const key = cacheKey("sales", p, startDate, endDate, paymentFilter, trimmedUser, minQtyNum, minItemsNum);
    const cached = cacheGet<{ sales: Sale[]; total: number }>(key);
    if (cached) {
      setSales(cached.sales);
      setTotal(cached.total);
      setLoading(false);
      return;
    }

    setLoading(true);
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
      setSales(res.sales);
      setTotal(res.total);
      cacheSet(key, { sales: res.sales, total: res.total });
    } catch (err) { console.warn("Error al cargar ventas:", err); }
    finally { setLoading(false); }
  };

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
      <Header total={total} />

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
