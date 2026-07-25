import type { ComponentProps } from "react";
import { PosCartTable } from "@/components/pages/pos/PosCartTable";
import { PosPaymentPanel } from "@/components/pages/pos/PosPaymentPanel";
import styles from "./PosMobileCheckout.module.css";

interface Props {
  /** Cierra la vista mobile-checkout (back button). */
  onClose: () => void;
  /** Props para `<PosCartTable>` (spreads directo al componente). */
  cartProps: ComponentProps<typeof PosCartTable>;
  /** Props para `<PosPaymentPanel>` (spreads directo al componente). */
  paymentProps: ComponentProps<typeof PosPaymentPanel>;
}

/**
 * Vista mobile-checkout del POS.
 *
 * Es un wrapper columnar que apila `<PosCartTable>` (arriba) y
 * `<PosPaymentPanel>` (abajo). Se renderiza condicionalmente desde
 * el parent (`{showMobileCheckout && <PosMobileCheckout .../>}`).
 *
 * **Por qué agrupar props**: el componente es estructural — no agrega
 * lógica propia, solo layout. Recibir los mismos props que la vista
 * desktop derecha, agrupados por sub-componente destino, evita
 * prop-drilling de 17 valores y mantiene unidireccional.
 */
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
