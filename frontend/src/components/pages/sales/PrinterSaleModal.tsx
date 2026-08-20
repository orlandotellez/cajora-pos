import { useState } from "react";
import { useToast } from "@/components/common/ui/Toast";
import styles from "./PrinterSaleModal.module.css"
import { isTauriRuntime } from "@/lib/fetch";
import { sendBytesToPrinter } from "@/lib/tcp-printer";
import { printReceiptBrowser } from "@/lib/browser-print";
import { useModalBack } from "@/hooks/useModalBack";
import { ApiError, printersApi, type Sale } from "@/api";
import { Printer, X } from "lucide-react";
import { getStoredCurrency, money } from "@/lib/format";
import { Fragment } from "react/jsx-runtime";

type Tab = "details" | "print";

interface PrinterSaleModal {
  selected: Sale
  setSelected: () => void
  setPrinting: (value: boolean) => void
  printing: boolean
  hasPrinter: boolean
  storeName: string
  storeAddress: string
  storePhone: string
  storeFooter: string
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
};

export const PrinterSaleModal = ({
  selected,
  setSelected,
  setPrinting,
  printing,
  hasPrinter,
  storeName,
  storeAddress,
  storePhone,
  storeFooter
}: PrinterSaleModal) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(setSelected);

  async function handlePrint() {
    setPrinting(true);
    try {
      // --- Web: imprimir desde el navegador ---
      if (!isTauriRuntime()) {
        const items = (selected.items ?? []).map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: item.line_total,
        }));
        const serviceItems = (selected.service_items ?? []).map((svc) => ({
          name: svc.service_name,
          quantity: 1,
          basePrice: svc.base_price,
          lineTotal: svc.line_total,
          products: svc.products.map((sp) => ({
            name: sp.product_name,
            quantity: sp.quantity,
            unitPrice: sp.unit_price,
            lineTotal: sp.line_total,
            isIncluded: !sp.affects_price,
            isAdditive: sp.affects_price,
          })),
        }));
        printReceiptBrowser({
          storeName,
          storeAddress,
          storePhone,
          storeFooter,
          saleId: selected.id,
          date: new Date(selected.created_at).toLocaleString("es-MX"),
          userName: selected.user_name,
          clientName: selected.client_name || "Cliente General",
          items,
          serviceItems,
          subtotal: selected.subtotal,
          discount: selected.discount,
          total: selected.total,
          paymentMethod: selected.payment_method,
          amountReceived: selected.amount_received ?? selected.total,
          change: selected.change_given ?? 0,
        });
        toast("Recibo abierto para impresión", "success");
        setPrinting(false);
        return;
      }

      // --- Tauri: imprimir via TCP directo ---
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
      const result = await printersApi.printReceipt(defaultPrinter.id, selected.id, 1, getStoredCurrency());

      if (!result.ticket_base64 || !result.printer) {
        toast("El servidor no generó el ticket correctamente", "error");
        return;
      }

      const tcpResult = await sendBytesToPrinter(
        result.ticket_base64,
        result.printer.address,
        result.printer.port,
      );

      if (tcpResult.success) {
        toast("Recibo impreso correctamente", "success");
      } else {
        toast(
          tcpResult.error || "No se pudo enviar el recibo a la impresora. Verificá que esté encendida y conectada.",
          "error"
        );
      }
    } catch (err) {
      toast(
        `Error al imprimir: ${(err as ApiError).message}`,
        "error"
      );
    } finally {
      setPrinting(false);
    }
  }

  const allItems = [...(selected.items ?? []), ...(selected.service_items ?? [])];

  return (
    <>
      <div className={styles.overlay} onClick={setSelected}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Venta {selected.id.slice(0, 8)}</h2>
            <div className={styles.modalHeaderActions}>
              <button onClick={handlePrint} className={styles.printBtn} disabled={printing || (isTauriRuntime() && !hasPrinter)}
                title={isTauriRuntime() && !hasPrinter ? "No hay impresora predeterminada configurada. Andá a Ajustes > Impresoras." : undefined}>
                <Printer size={16} /> Reimprimir
              </button>
              <button onClick={setSelected} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>
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
                    <dd>{selected.id.slice(0, 8)}</dd>
                  </div>
                  <div className={styles.detailsRow}>
                    <dt>Fecha</dt>
                    <dd>{new Date(selected.created_at).toLocaleString("es-MX")}</dd>
                  </div>
                  <div className={styles.detailsRow}>
                    <dt>Vendedor</dt>
                    <dd>{selected.user_name}</dd>
                  </div>
                  <div className={styles.detailsRow}>
                    <dt>Cliente</dt>
                    <dd>{selected.client_name || "Cliente General"}</dd>
                  </div>
                  <div className={styles.detailsRow}>
                    <dt>Método de pago</dt>
                    <dd>{PAYMENT_LABELS[selected.payment_method] ?? selected.payment_method}</dd>
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
                    {(selected.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td className={styles.detailsTdRight}>{item.quantity}</td>
                        <td className={styles.detailsTdRight}>{money(item.unit_price)}</td>
                        <td className={styles.detailsTdRight}>{money(item.line_total)}</td>
                      </tr>
                    ))}
                    {(selected.service_items ?? []).map((svc) => (
                      <Fragment key={svc.id}>
                        <tr>
                          <td>{svc.service_name}</td>
                          <td className={styles.detailsTdRight}>1</td>
                          <td className={styles.detailsTdRight}>{money(svc.base_price)}</td>
                          <td className={styles.detailsTdRight}>{money(svc.line_total)}</td>
                        </tr>
                        {svc.products.filter((sp) => sp.quantity > 0 && !sp.affects_price).map((sp) => (
                          <tr key={`${svc.id}-inc-${sp.id}`} className={styles.detailsTrSub}>
                            <td colSpan={3}>Incluye: {sp.product_name} × {sp.quantity}</td>
                            <td className={styles.detailsTdRight}>—</td>
                          </tr>
                        ))}
                        {svc.products.filter((sp) => sp.quantity > 0 && sp.affects_price).map((sp) => (
                          <tr key={`${svc.id}-add-${sp.id}`} className={styles.detailsTrSub}>
                            <td>+ {sp.product_name} × {sp.quantity}</td>
                            <td></td>
                            <td className={styles.detailsTdRight}>{money(sp.unit_price)}</td>
                            <td className={styles.detailsTdRight}>{money(sp.unit_price * sp.quantity)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={styles.detailsSection}>
                <h3 className={styles.detailsSectionTitle}>Resumen</h3>
                <div className={styles.detailsSummary}>
                  <div className={styles.detailsSummaryRow}>
                    <span>Subtotal</span>
                    <span>{money(selected.subtotal)}</span>
                  </div>
                  {selected.discount > 0 && (
                    <div className={styles.detailsSummaryRow}>
                      <span>Descuento</span>
                      <span>−{money(selected.discount)}</span>
                    </div>
                  )}
                  <div className={`${styles.detailsSummaryRow} ${styles.detailsSummaryTotal}`}>
                    <span>Total</span>
                    <span>{money(selected.total)}</span>
                  </div>
                  <div className={styles.detailsSummaryRow}>
                    <span>Pagado</span>
                    <span>{money(selected.amount_received ?? selected.total)}</span>
                  </div>
                  {selected.change_given != null && selected.change_given > 0 && (
                    <div className={styles.detailsSummaryRow}>
                      <span>Cambio</span>
                      <span>{money(selected.change_given)}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Diseño de impresión - Estilo recibo */}
          {activeTab === "print" && (
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
                <div>Cliente: {selected.client_name || "Cliente General"}</div>
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
          )}
        </div>
      </div>
    </>
  )
}
