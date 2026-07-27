import React, { useEffect, useState } from "react";
import { CheckCircle, Loader2, Printer } from "lucide-react";
import { money } from "@/lib/format";
import { printersApi } from "@/api/printers";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";
import styles from "./PosCompletedSaleModal.module.css";

interface CompletedSaleData {
  saleId: string;
  userName: string;
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
  const currency = usePosStore((s) => s.currency);

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
  return (
    <div className={styles.overlay} onClick={() => { }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <CheckCircle />
          </div>
          <h2 className={styles.title}>Venta realizada exitosamente</h2>
        </div>

        <div className={styles.ticket}>
          <div className={styles.storeName}>{storeName}</div>
          {storeAddress && <div className={styles.address}>{storeAddress}</div>}
          {storePhone && <div className={styles.phone}>{storePhone}</div>}
          <div className={styles.date}>{new Date().toLocaleString("es-MX")}</div>
          <div className={styles.ticketId}>Ticket: {completedSale.saleId.slice(0, 8)}</div>
          <div className={styles.ticketId}>Atendido por: {completedSale.userName}</div>

          <div className={styles.divider} />

          <table className={styles.table}>
            <tbody>
              {completedSale.cart.map((x) => {
                if (x._type === "product") {
                  const prod = x as ProductCartItem;
                  return (
                    <tr key={x.id}>
                      <td className={styles.tdLeft}>{x.quantity}× {x.name}</td>
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
                      <td className={styles.tdLeft}>{svcQty}× {svc.name}</td>
                      <td className={styles.tdRight}>{money(baseTotal, currency)}</td>
                    </tr>
                    {svc.products
                      .filter((sp) => sp.quantity > 0 && !sp.affects_price)
                      .map((sp) => (
                        <tr key={`${x.id}-inc-${sp.product_id}`}>
                          <td className={styles.tdSub} colSpan={2}>{sp.product_name} × {sp.quantity * svcQty}</td>
                        </tr>
                      ))}
                    {svc.products
                      .filter((sp) => sp.quantity > 0 && sp.affects_price)
                      .map((sp) => (
                        <tr key={`${x.id}-add-${sp.product_id}`}>
                          <td className={styles.tdSub}>+ {sp.product_name} × {sp.quantity * svcQty}</td>
                          <td className={styles.tdRightSub}>{money(sp.unit_price * sp.quantity * svcQty, currency)}</td>
                        </tr>
                      ))}
                    {additiveTotal > 0 && (
                      <tr key={`${x.id}-total`}>
                        <td className={styles.tdTotalLine}>Total servicio</td>
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
            <span>{money(completedSale.payment === "efectivo" || completedSale.received ? Number(completedSale.received || 0) : completedSale.totals.total, currency)}</span>
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

        {printing && (
          <div className={styles.printingOverlay}>
            <div className={styles.printingBox}>
              <Loader2 size={36} className={styles.spinner} />
              <span className={styles.printingText}>Imprimiendo…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
