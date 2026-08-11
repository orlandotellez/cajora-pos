import { useEffect, useState } from "react";
import { salesApi, type Sale } from "@/api/sales";
import { printersApi } from "@/api/printers";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useCrudPagination } from "@/hooks/useCrudPagination";
import { SaleTable } from "@/components/pages/sales/SaleTable";
import styles from "./Sales.module.css";
import { cacheClear } from "@/lib/simple-cache";
import { Header } from "@/components/pages/sales/Header";
import { Filter } from "@/components/pages/sales/Filter";
import { PrinterSaleModal } from "@/components/pages/sales/PrinterSaleModal";
import { PrinterLoad } from "@/components/common/PrinterLoad";

export default function Sales() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [userNameFilter, setUserNameFilter] = useState("");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [minItemsFilter, setMinItemsFilter] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [printing, setPrinting] = useState(false);
  const [hasPrinter, setHasPrinter] = useState(true);

  useEffect(() => {
    printersApi.list().then((res) => {
      setHasPrinter(res.printers.some((p) => p.is_default && p.is_active && p.connection_type === "net"));
    }).catch(() => setHasPrinter(false));
  }, []);
  const { storeName, storeAddress, storePhone, storeFooter } = useStoreSettings();

  const {
    items: sales,
    total,
    page,
    loading,
    refreshing,
    totalPages,
    setPage,
    refreshImmediate,
  } = useCrudPagination<Sale>({
    cacheNamespace: "sales",
    pollMs: 5_000,
    debounceMs: 300,
    realtimeEvents: ["sale.created"],
    extraFilters: {
      startDate,
      endDate,
      paymentFilter,
      userName: userNameFilter,
      minQty: minQtyFilter,
      minItems: minItemsFilter,
    },
    fetcher: async ({ page, limit, extraFilters }) => {
      const minQtyNum = extraFilters.minQty?.trim()
        ? Math.max(1, Math.floor(Number(extraFilters.minQty)))
        : 0;
      const minItemsNum = extraFilters.minItems?.trim()
        ? Math.max(1, Math.floor(Number(extraFilters.minItems)))
        : 0;
      const res = await salesApi.list({
        page,
        limit,
        start_date: extraFilters.startDate || undefined,
        end_date: extraFilters.endDate || undefined,
        payment_method: extraFilters.paymentFilter || undefined,
        q: extraFilters.userName?.trim() || undefined,
        min_total_qty: minQtyNum > 0 ? minQtyNum : undefined,
        min_items_count: minItemsNum > 0 ? minItemsNum : undefined,
      });
      return { items: res.sales, total: res.total };
    },
  });

  // Cambiar cualquier filtro vuelve a la página 1 (igual que antes).
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, paymentFilter, userNameFilter, minQtyFilter, minItemsFilter]);

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
    setPage(1);
  }

  function handleRefresh() {
    cacheClear("sales");
    refreshImmediate();
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
      <Header total={total} refreshing={refreshing} onRefresh={handleRefresh} loading={loading} />

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
        totalPages={totalPages}
        onPageChange={setPage}
        onView={openDetails}
        dimmed={false}
        refreshing={refreshing}
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
