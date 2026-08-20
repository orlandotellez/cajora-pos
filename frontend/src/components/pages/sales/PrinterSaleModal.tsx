import { useToast } from "@/components/common/ui/Toast";
import styles from "./PrinterSaleModal.module.css"
import { isTauriRuntime } from "@/lib/fetch";
import { sendBytesToPrinter } from "@/lib/tcp-printer";
import { useModalBack } from "@/hooks/useModalBack";
import { ApiError, printersApi, type Sale } from "@/api";
import { Printer, X } from "lucide-react";
import { getStoredCurrency, money } from "@/lib/format";
import { Fragment } from "react/jsx-runtime";

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
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(setSelected);
  return (
    <>
      <div className={styles.overlay} onClick={setSelected}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Ticket de venta</h2>
            <div className={styles.modalHeaderActions}>
              <button onClick={async () => {
                setPrinting(true);
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
                  const result = await printersApi.printReceipt(defaultPrinter.id, selected.id, 1, getStoredCurrency());

                  if (!result.ticket_base64 || !result.printer) {
                    toast("El servidor no generó el ticket correctamente", "error");
                    return;
                  }

                  let printSuccess: boolean;
                  let printError: string | null = null;

                  if (isTauriRuntime()) {
                    const tcpResult = await sendBytesToPrinter(
                      result.ticket_base64,
                      result.printer.address,
                      result.printer.port,
                    );
                    printSuccess = tcpResult.success;
                    printError = tcpResult.error;
                  } else {
                    const proxyResult = await printersApi.sendTcp(
                      result.ticket_base64,
                      result.printer.address,
                      result.printer.port,
                    );
                    printSuccess = proxyResult.success;
                  }

                  if (printSuccess) {
                    toast("Recibo impreso correctamente", "success");
                  } else {
                    toast(
                      printError || "No se pudo enviar el recibo a la impresora. Verificá que esté encendida y conectada.",
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
              }} className={styles.printBtn} disabled={printing || !hasPrinter}
                title={!hasPrinter ? "No hay impresora predeterminada configurada. Andá a Ajustes > Impresoras." : undefined}>
                <Printer size={16} /> {!hasPrinter ? "Sin impresora" : "Reimprimir"}
              </button>
              <button onClick={setSelected} className={styles.modalClose}>
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
        </div>
      </div>
    </>
  )
}

