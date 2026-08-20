import React, { useEffect, useState } from "react";
import { CheckCircle, Printer } from "lucide-react";
import { money } from "@/lib/format";
import { printersApi } from "@/api/printers";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";
import styles from "./PosCompletedSaleModal.module.css";
import { PrinterLoad } from "@/components/common/PrinterLoad";
import { useModalBack } from "@/hooks/useModalBack";

type Tab = "details" | "print";

interface CompletedSaleData {
  saleId: string;
  userName: string;
  clientName: string | null;
  cart: CartItem[];
  totals: { subtotal: number; discount: number; total: number; change: number };
  payment: string;
  received: string;
  discountPct: number;
}

interface PosCompletedSaleModalProps {
  completedSale: CompletedSaleData;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeFooter: string;
  onPrint: (saleId: string, userName: string) => void | Promise<void>;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
};

export function PosCompletedSaleModal({
  completedSale,
  storeName,
  storeAddress,
  storePhone,
  storeFooter,
  onPrint,
  onClose,
}: PosCompletedSaleModalProps) {
  const [printing, setPrinting] = useState(false);
  const [hasPrinter, setHasPrinter] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const currency = usePosStore((s) => s.currency);
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(onClose);

  useEffect(() => {
    printersApi.list().then((res) => {
      const hasDefault = res.printers.some((p) => p.is_default && p.is_active && p.connection_type === "net");
      setHasPrinter(hasDefault);
    }).catch(() => setHasPrinter(false));
  }, []);

  async function handlePrint() {
    setPrinting(true);
    try {
      await onPrint(completedSale.saleId, completedSale.userName);
    } catch {
      // error handling is done inside onPrint
    } finally {
      setPrinting(false);
    }
  }

  const received = completedSale.payment === "efectivo" || completedSale.received
    ? Number(completedSale.received || 0)
    : completedSale.totals.total;

  return (
    <div className={styles.overlay} onClick={() => { }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <CheckCircle color="rgb(22, 163, 74)" />
          </div>
          <h2 className={styles.title}>Venta realizada exitosamente</h2>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "details" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Detalles de la venta
          </button>
          <button
            className={`${styles.tab} ${activeTab === "print" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("print")}
          >
            Diseño de impresión
          </button>
        </div>

        {/* Detalles de la venta - Vista formal */}
        {activeTab === "details" && (
          <div className={styles.detailsView}>
            <section className={styles.detailsSection}>
              <h3 className={styles.detailsSectionTitle}>Información general</h3>
              <dl className={styles.detailsList}>
                <div className={styles.detailsRow}>
                  <dt>Folio</dt>
                  <dd>{completedSale.saleId.slice(0, 8)}</dd>
                </div>
                <div className={styles.detailsRow}>
                  <dt>Fecha</dt>
                  <dd>{new Date().toLocaleString("es-MX")}</dd>
                </div>
                <div className={styles.detailsRow}>
                  <dt>Vendedor</dt>
                  <dd>{completedSale.userName}</dd>
                </div>
                <div className={styles.detailsRow}>
                  <dt>Cliente</dt>
                  <dd>{completedSale.clientName || "Cliente General"}</dd>
                </div>
                <div className={styles.detailsRow}>
                  <dt>Método de pago</dt>
                  <dd>{PAYMENT_LABELS[completedSale.payment] ?? completedSale.payment}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.detailsSection}>
              <h3 className={styles.detailsSectionTitle}>Artículos</h3>
              <table className={styles.detailsTable}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className={styles.detailsThRight}>Cant.</th>
                    <th className={styles.detailsThRight}>P. Unit.</th>
                    <th className={styles.detailsThRight}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSale.cart.map((x) => {
                    if (x._type === "product") {
                      const prod = x as ProductCartItem;
                      return (
                        <tr key={x.id}>
                          <td>{x.name}</td>
                          <td className={styles.detailsTdRight}>{x.quantity}</td>
                          <td className={styles.detailsTdRight}>{money(prod.price, currency)}</td>
                          <td className={styles.detailsTdRight}>{money(prod.price * x.quantity, currency)}</td>
                        </tr>
                      );
                    }
                    const svc = x as ServiceCartItem;
                    const svcQty = svc.quantity;
                    const baseTotal = svc.base_price * svcQty;
                    const additivePerInstance = svc.products
                      .filter((sp) => sp.affects_price)
                      .reduce((s, sp) => s + sp.unit_price * sp.quantity, 0);
                    const additiveTotal = additivePerInstance * svcQty;
                    return (
                      <React.Fragment key={x.id}>
                        <tr>
                          <td>{svc.name}</td>
                          <td className={styles.detailsTdRight}>{svcQty}</td>
                          <td className={styles.detailsTdRight}>{money(svc.base_price, currency)}</td>
                          <td className={styles.detailsTdRight}>{money(baseTotal, currency)}</td>
                        </tr>
                        {svc.products
                          .filter((sp) => sp.quantity > 0 && !sp.affects_price)
                          .map((sp) => (
                            <tr key={`${x.id}-inc-${sp.product_id}`} className={styles.detailsTrSub}>
                              <td colSpan={3}>Incluye: {sp.product_name} x {sp.quantity * svcQty}</td>
                              <td className={styles.detailsTdRight}>—</td>
                            </tr>
                          ))}
                        {svc.products
                          .filter((sp) => sp.quantity > 0 && sp.affects_price)
                          .map((sp) => (
                            <tr key={`${x.id}-add-${sp.product_id}`} className={styles.detailsTrSub}>
                              <td>+ {sp.product_name} x {sp.quantity * svcQty}</td>
                              <td></td>
                              <td className={styles.detailsTdRight}>{money(sp.unit_price, currency)}</td>
                              <td className={styles.detailsTdRight}>{money(sp.unit_price * sp.quantity * svcQty, currency)}</td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className={styles.detailsSection}>
              <h3 className={styles.detailsSectionTitle}>Resumen</h3>
              <div className={styles.detailsSummary}>
                <div className={styles.detailsSummaryRow}>
                  <span>Subtotal</span>
                  <span>{money(completedSale.totals.subtotal, currency)}</span>
                </div>
                {completedSale.discountPct > 0 && (
                  <div className={styles.detailsSummaryRow}>
                    <span>Descuento ({completedSale.discountPct}%)</span>
                    <span>−{money(completedSale.totals.discount, currency)}</span>
                  </div>
                )}
                <div className={`${styles.detailsSummaryRow} ${styles.detailsSummaryTotal}`}>
                  <span>Total</span>
                  <span>{money(completedSale.totals.total, currency)}</span>
                </div>
                <div className={styles.detailsSummaryRow}>
                  <span>Pagado</span>
                  <span>{money(received, currency)}</span>
                </div>
                {completedSale.totals.change > 0 && (
                  <div className={styles.detailsSummaryRow}>
                    <span>Cambio</span>
                    <span>{money(completedSale.totals.change, currency)}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Diseño de impresión - Estilo recibo */}
        {activeTab === "print" && (
          <div className={styles.ticket}>
            <div className={styles.storeName}>{storeName}</div>
            {storeAddress && <div className={styles.address}>{storeAddress}</div>}
            {storePhone && <div className={styles.phone}>{storePhone}</div>}
            <div className={styles.date}>{new Date().toLocaleString("es-MX")}</div>
            <div className={styles.ticketId}>Ticket: {completedSale.saleId.slice(0, 8)}</div>
            <div className={styles.ticketId}>Atendido por: {completedSale.userName}</div>
            <div className={styles.ticketId}>Cliente: {completedSale.clientName || "Cliente General"}</div>

            <div className={styles.divider} />

            <table className={styles.table}>
              <thead>
                <tr>
                  <td className={styles.tdLeft}>Cant</td>
                  <td className={styles.tdLeft}>Producto</td>
                  <td className={styles.tdRight}>P.Unit</td>
                  <td className={styles.tdRight}>Subt</td>
                </tr>
              </thead>
              <tbody>
                {completedSale.cart.map((x) => {
                  if (x._type === "product") {
                    const prod = x as ProductCartItem;
                    return (
                      <tr key={x.id}>
                        <td className={styles.tdLeft}>{x.quantity}</td>
                        <td className={styles.tdLeft}>{x.name}</td>
                        <td className={styles.tdRight}>{money(prod.price, currency)}</td>
                        <td className={styles.tdRight}>{money(prod.price * x.quantity, currency)}</td>
                      </tr>
                    );
                  }
                  const svc = x as ServiceCartItem;
                  const svcQty = svc.quantity;
                  const baseTotal = svc.base_price * svcQty;
                  const additivePerInstance = svc.products
                    .filter((sp) => sp.affects_price)
                    .reduce((s, sp) => s + sp.unit_price * sp.quantity, 0);
                  const additiveTotal = additivePerInstance * svcQty;
                  return (
                    <React.Fragment key={x.id}>
                      <tr>
                        <td className={styles.tdLeft}>{svcQty}</td>
                        <td className={styles.tdLeft}>{svc.name}</td>
                        <td className={styles.tdRight}>{money(svc.base_price, currency)}</td>
                        <td className={styles.tdRight}>{money(baseTotal, currency)}</td>
                      </tr>
                      {svc.products
                        .filter((sp) => sp.quantity > 0 && !sp.affects_price)
                        .map((sp) => (
                          <tr key={`${x.id}-inc-${sp.product_id}`}>
                            <td className={styles.tdSub} colSpan={2}>Incluye: {sp.product_name} x{sp.quantity * svcQty}</td>
                            <td className={styles.tdRightSub}></td>
                            <td className={styles.tdRightSub}></td>
                          </tr>
                        ))}
                      {svc.products
                        .filter((sp) => sp.quantity > 0 && sp.affects_price)
                        .map((sp) => (
                          <tr key={`${x.id}-add-${sp.product_id}`}>
                            <td className={styles.tdSub}>{sp.quantity * svcQty}</td>
                            <td className={styles.tdSub}>+ {sp.product_name}</td>
                            <td className={styles.tdRightSub}>{money(sp.unit_price, currency)}</td>
                            <td className={styles.tdRightSub}>{money(sp.unit_price * sp.quantity * svcQty, currency)}</td>
                          </tr>
                        ))}
                      {additiveTotal > 0 && (
                        <tr key={`${x.id}-total`}>
                          <td className={styles.tdTotalLine} colSpan={3}>Total servicio</td>
                          <td className={styles.tdRightTotalLine}>{money(baseTotal + additiveTotal, currency)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.divider} />

            <div className={styles.totRow}>
              <span>Subtotal</span>
              <span>{money(completedSale.totals.subtotal, currency)}</span>
            </div>
            {completedSale.discountPct > 0 && (
              <div className={styles.totRow}>
                <span>Descuento ({completedSale.discountPct}%)</span>
                <span>−{money(completedSale.totals.discount, currency)}</span>
              </div>
            )}
            <div className={`${styles.totRow} ${styles.totTotal}`}>
              <span>TOTAL</span>
              <span>{money(completedSale.totals.total, currency)}</span>
            </div>
            <div className={styles.totRow}>
              <span>Pago ({completedSale.payment})</span>
              <span>{money(received, currency)}</span>
            </div>
            {completedSale.totals.change > 0 && (
              <div className={styles.totRow}>
                <span>Cambio</span>
                <span>{money(completedSale.totals.change, currency)}</span>
              </div>
            )}
            {storeFooter && (
              <>
                <div className={styles.divider} />
                <div className={styles.footer}>{storeFooter}</div>
              </>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={handlePrint}
            className={styles.printBtn}
            autoFocus
            disabled={printing || !hasPrinter}
            title={!hasPrinter ? "No hay impresora predeterminada configurada. Andá a Ajustes > Impresoras." : undefined}
          >
            {!hasPrinter ? <Printer size={16} /> : null}
            {printing ? "Imprimiendo…" : !hasPrinter ? "Sin impresora" : "Imprimir"}
          </button>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            disabled={printing}
          >
            Cerrar
          </button>
        </div>

        {printing && <PrinterLoad />}
      </div>
    </div>
  );
}
