import { Fragment, useEffect, useState } from "react";
import { Search, X, Printer } from "lucide-react";
import { salesApi, type Sale } from "@/api/sales";
import { settingsApi } from "@/api/settings";
import { money } from "@/lib/format";
import { printHtml, buildTicketHtml, buildTicketProductRow, buildTicketServiceRows } from "@/lib/print-ticket";
import { PAYMENT_METHODS } from "@/lib/constants";
import { SaleTable } from "@/components/pages/sales/SaleTable";
import styles from "./Sales.module.css";
import { cacheGet, cacheKey, cacheSet } from "@/lib/simple-cache";

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeFooter, setStoreFooter] = useState("");

  const LIMIT = 10;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    settingsApi.get().then((res) => {
      setStoreName(res.name);
      if (res.address) setStoreAddress(res.address);
      if (res.phone) setStorePhone(res.phone);
      if (res.ticket_footer) setStoreFooter(res.ticket_footer);
    }).catch((err) => console.warn("Error al cargar config:", err));
  }, []);

  const fetchSales = async (p: number) => {
    const key = cacheKey("sales", p, startDate, endDate, paymentFilter);
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
      });
      setSales(res.sales);
      setTotal(res.total);
      cacheSet(key, { sales: res.sales, total: res.total });
    } catch (err) { console.warn("Error al cargar ventas:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSales(page); }, [page, paymentFilter]);

  function handleSearch() { setPage(1); }

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

      {}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Desde</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={styles.filterInput} />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={styles.filterInput} />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Pago</label>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={styles.filterSelect}>
            <option value="">Todos</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm.value} value={pm.value}>{pm.label}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSearch} className={styles.searchBtn}>
          <Search size={16} /> Buscar
        </button>
      </div>

      <SaleTable
        sales={sales}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onView={openDetails}
        dimmed={false}
      />

      {}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Ticket de venta</h2>
              <div className={styles.modalHeaderActions}>
                <button onClick={() => printSaleTicket(selected, storeName, storeAddress, storePhone, storeFooter)} className={styles.printBtn}>
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

function printSaleTicket(sale: Sale, storeName: string, storeAddress?: string, storePhone?: string, storeFooter?: string) {
  const date = new Date(sale.created_at).toLocaleString("es-MX");

  const productRows = (sale.items ?? []).map((item) =>
    buildTicketProductRow({ name: item.product_name, quantity: item.quantity, lineTotal: item.line_total })
  ).join("");
  const serviceRows = (sale.service_items ?? []).map((svc) =>
    buildTicketServiceRows({
      displayName: svc.service_name,
      basePrice: svc.base_price,
      lineTotal: svc.line_total,
      products: svc.products.map((sp) => ({
        name: sp.product_name,
        quantity: sp.quantity,
        unitPrice: sp.unit_price,
        affectsPrice: sp.affects_price ?? false,
      })),
    })
  ).join("");
  const rows = productRows + serviceRows;

  const html = buildTicketHtml({
    storeName: storeName || "Tienda",
    storeAddress,
    storePhone,
    storeFooter,
    saleId: sale.id,
    date,
    rows,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.payment_method,
    amountReceived: sale.amount_received ?? sale.total,
    changeGiven: sale.change_given ?? 0,
  });

  printHtml(html);
}
