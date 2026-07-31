import type { ComponentProps } from "react";
import { PosCartTable } from "./PosCartTable";
import { PosPaymentPanel } from "./PosPaymentPanel";
import styles from "./PosMobileCheckout.module.css";

interface Props {
  onClose: () => void;
  cartProps: ComponentProps<typeof PosCartTable>;
  paymentProps: ComponentProps<typeof PosPaymentPanel>;
}

export function PosMobileCheckout({ onClose, cartProps, paymentProps }: Props) {
  return (
    <div className={styles["mobile-checkout"]}>
      <div className={styles["mobile-checkout-header"]}>
        <button onClick={onClose} className={styles["mobile-checkout-back"]}>
          ← Regresar
        </button>
        <span className={styles["mobile-checkout-title"]}>Cobrar</span>
      </div>

      <div className={styles["mobile-checkout-cart"]}>
        <PosCartTable {...cartProps} />
      </div>

      <div className={styles["mobile-checkout-payment"]}>
        <PosPaymentPanel {...paymentProps} />
      </div>
    </div>
  );
}
