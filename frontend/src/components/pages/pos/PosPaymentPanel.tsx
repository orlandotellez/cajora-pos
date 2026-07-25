import { X } from "lucide-react";
import { money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { usePosStore } from "@/store/posStore";
import styles from "../../../pages/Pos.module.css";



function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}



interface PosPaymentPanelProps {
  totals: { subtotal: number; discount: number; total: number; change: number };
  cartLength: number;
  discountPct: number;
  payment: string;
  received: string;
  manualAmount: boolean;
  checkingOut: boolean;
  onDiscountPct: (v: number) => void;
  onPayment: (v: string) => void;
  onReceived: (v: string) => void;
  onManualAmount: (v: boolean) => void;
  onCheckout: () => void;
  onClearCart: () => void;
}

export function PosPaymentPanel({
  totals, cartLength, discountPct, payment, received, manualAmount, checkingOut,
  onDiscountPct, onPayment, onReceived, onManualAmount, onCheckout, onClearCart,
}: PosPaymentPanelProps) {
  const currency = usePosStore((s) => s.currency);
  return (
    <>
      <div className={styles.totalsSection}>
        <Row label="Subtotal" value={money(totals.subtotal, currency)} />
        <div className={styles.discountRow}>
          <label className={styles.discountLabel}>Descuento %</label>
          <input
            type="number" min={0} max={100} value={discountPct}
            onChange={(e) => onDiscountPct(Number(e.target.value) || 0)}
            className={styles.discountInput}
          />
        </div>
        <Row label="− Descuento" value={money(totals.discount, currency)} />
      </div>

      <div className={styles.divider} />

      <div className={styles.totalRow}>
        <div className={styles.totalLabel}>Total</div>
        <div className={styles.totalValue}>{money(totals.total, currency)}</div>
      </div>

      <div className={styles.paymentSection}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Método de pago</label>
          <select
            value={payment}
            onChange={(e) => onPayment(e.target.value)}
            className={styles.select}
          >
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm.value} value={pm.value}>{pm.label}</option>
            ))}
          </select>
        </div>
        {payment !== "credito" && (
          <>
            {payment === "tarjeta" || payment === "transferencia"
              ? (
                <label className={styles.manualAmountLabel}>
                  <input
                    type="checkbox"
                    checked={manualAmount}
                    onChange={(e) => onManualAmount(e.target.checked)}
                    className={styles.manualAmountCheckbox}
                  />
                  Adjuntar monto manualmente
                </label>
              )
              : null}
            {(payment === "efectivo" || manualAmount) && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Monto recibido</label>
                  <input
                    type="number" min={0} value={received}
                    onChange={(e) => onReceived(e.target.value)}
                    className={`${styles.input} ${styles.inputRight}`}
                  />
                </div>
                <div className={styles.changeRow}>
                  <span className={styles.changeLabel}>Cambio</span>
                  <span className={`${styles.changeValue} ${received && Number(received) < totals.total ? styles.changeNegative : ""}`}>
                    {received && Number(received) < totals.total
                      ? `−${money(totals.total - Number(received), currency)}`
                      : money(totals.change, currency)
                    }
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button
        onClick={onCheckout}
        disabled={cartLength === 0 || checkingOut || ((payment === "efectivo" || manualAmount) && received !== "" && Number(received || 0) < totals.total)}
        className={styles.checkoutBtn}
      >
        {checkingOut ? "Procesando venta..." : "Cobrar"}
      </button>
      {cartLength > 0 && (
        <button onClick={onClearCart} className={styles.clearCart}>
          <X size={12} /> Vaciar carrito
        </button>
      )}
    </>
  );
}
