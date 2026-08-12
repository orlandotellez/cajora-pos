import type { ComponentProps } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { PosCartTable } from "./PosCartTable";
import { PosPaymentPanel } from "./PosPaymentPanel";
import styles from "./PosMobileCheckout.module.css";

interface Props {
  onClose: () => void;
  cartProps: ComponentProps<typeof PosCartTable>;
  paymentProps: ComponentProps<typeof PosPaymentPanel>;
}

export function PosMobileCheckout({ onClose, cartProps, paymentProps }: Props) {
  // Botón de retroceso de Android / gesto de regreso vuelve al POS en vez de
  // navegar a la página anterior o salir de la app.
  useModalBack(onClose);

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
