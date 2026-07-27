import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { X, Printer } from "lucide-react";
import { salesApi, type Sale } from "@/api/sales";
import { printersApi } from "@/api/printers";
import { ApiError } from "@/api/client";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { money } from "@/lib/format";
import { PAGE_LIMIT as LIMIT, PAYMENT_METHODS } from "@/lib/constants";
import { useToast } from "@/components/common/ui/Toast";
import { SaleTable } from "@/components/pages/sales/SaleTable";
import styles from "./Sales.module.css";
import { cacheGet, cacheKey, cacheSet } from "@/lib/simple-cache";

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
  const { toast } = useToast();
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
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Ventas</h1>
          <p className={styles.subtitle}>{total} venta(s) registradas</p>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="Fecha desde"
          className={styles.filterInput}
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="Fecha hasta"
          className={styles.filterInput}
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          aria-label="Tipo de pago"
          className={styles.filterSelect}
        >
          <option value="">Todos los pagos</option>
          {PAYMENT_METHODS.map((pm) => (
            <option key={pm.value} value={pm.value}>{pm.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={userNameFilter}
          onChange={(e) => setUserNameFilter(e.target.value)}
          placeholder="Usuario"
          aria-label="Filtrar por usuario"
          className={styles.filterInput}
        />
        <input
          type="number"
          min="1"
          value={minQtyFilter}
          onChange={(e) => setMinQtyFilter(e.target.value)}
          placeholder="Cantidad mín."
          aria-label="Cantidad mínima (suma de unidades en la venta)"
          className={`${styles.filterInput} ${styles.filterInputNarrow}`}
        />
        <input
          type="number"
          min="1"
          value={minItemsFilter}
          onChange={(e) => setMinItemsFilter(e.target.value)}
          placeholder="Arts. mín."
          aria-label="Artículos mínimos (líneas distintas en la venta)"
          className={`${styles.filterInput} ${styles.filterInputNarrow}`}
        />
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className={styles.clearBtn} title="Limpiar todos los filtros">
            <X size={14} />
            <span>Limpiar</span>
          </button>
        )}
      </div>

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
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Ticket de venta</h2>
              <div className={styles.modalHeaderActions}>
                <button onClick={async () => {
                  try {
                    const res = await printersApi.list();
                    const defaultPrinter = res.printers.find(
                      (p) => p.is_default && p.is_active
                    );
                    if (!defaultPrinter) {
                      toast(
                        "No hay una impresora predeterminada configurada. Configurá una en Ajustes > Impresoras.",
                        "error"
                      );
                      return;
                    }
                    const result = await printersApi.printReceipt(defaultPrinter.id, selected.id, 1);
                    if (result.success) {
                      toast("Recibo impreso correctamente", "success");
                    } else {
                      toast(
                        result.error || "No se pudo imprimir el recibo. Verificá la conexión con la impresora.",
                        "error"
                      );
                    }
                  } catch (err) {
                    toast(
                      `Error al imprimir: ${(err as ApiError).message}`,
                      "error"
                    );
                  }
                }} className={styles.printBtn}>
                  <Printer size={16} /> Reimprimir
                </button>
                <button onClick={() => setSelected(null)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.ticket}>
              <div className={styles.ticketHeader}>
                <strong>{storeName || "Tienda"}</strong>
                {storeAddress && <div className={styles.ticketAddress}>{storeAddress}</div>}
                {storePhone && <div className={styles.ticketAddress}>{storePhone}</div>}
              </div>
              <div className={styles.ticketMeta}>
                <div>{new Date(selected.created_at).toLocaleString("es-MX")}</div>
                <div>Ticket: {selected.id.slice(0, 8)}</div>
                <div>Atendido por: {selected.user_name}</div>
              </div>
              <div className={styles.ticketDivider}></div>

              <table className={styles.ticketTable}>
                <tbody>
                  {(selected.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className={styles.ticketTdLeft}>{item.quantity}× {item.product_name}</td>
                      <td className={styles.ticketTdRight}>{money(item.line_total)}</td>
                    </tr>
                  ))}
                  {(selected.service_items ?? []).map((svc) => (
                    <Fragment key={svc.id}>
                      <tr>
                        <td className={styles.ticketTdLeft}>{svc.service_name}</td>
                        <td className={styles.ticketTdRight}>{money(svc.base_price)}</td>
                      </tr>
                      {svc.products.filter((sp) => sp.quantity > 0 && !sp.affects_price).map((sp) => (
                        <tr key={`${svc.id}-inc-${sp.id}`}>
                          <td className={styles.ticketTdSub} colSpan={2}>Incluye: {sp.product_name} × {sp.quantity}</td>
                        </tr>
                      ))}
                      {svc.products.filter((sp) => sp.quantity > 0 && sp.affects_price).map((sp) => (
                        <tr key={`${svc.id}-add-${sp.id}`}>
                          <td className={styles.ticketTdSub}>+ {sp.product_name} × {sp.quantity}</td>
                          <td className={styles.ticketTdRightSub}>{money(sp.unit_price * sp.quantity)}</td>
                        </tr>
                      ))}
                      {svc.products.some((sp) => sp.affects_price) && (
                        <tr>
                          <td className={styles.ticketTdTotalLine}>Total servicio</td>
                          <td className={styles.ticketTdRightTotalLine}>{money(svc.line_total)}</td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>

              <div className={styles.ticketDivider}></div>

              <div className={styles.ticketRows}>
                <div className={styles.ticketRow}><span>Subtotal</span><span>{money(selected.subtotal)}</span></div>
                {selected.discount > 0 && <div className={styles.ticketRow}><span>Descuento</span><span>−{money(selected.discount)}</span></div>}
                <div className={`${styles.ticketRow} ${styles.ticketRowTotal}`}><span>TOTAL</span><span>{money(selected.total)}</span></div>
                <div className={styles.ticketRow}><span>Pago ({selected.payment_method})</span><span>{money(selected.amount_received ?? selected.total)}</span></div>
                {selected.change_given != null && selected.change_given > 0 && (
                  <div className={styles.ticketRow}><span>Cambio</span><span>{money(selected.change_given)}</span></div>
                )}
              </div>
              <div className={styles.ticketFooter}>{storeFooter}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
