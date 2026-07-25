import { ScanBarcode } from "lucide-react";
import type { RefObject } from "react";
import styles from "./PosScannerSection.module.css";

interface Props {
  /** Estado actual del scanner (true = activo + viewfinder visible). */
  active: boolean;
  /** Toggle on/off del scanner. */
  onToggle: () => void;
  /** ID del elemento DOM donde se monta el viewfinder (provisto por usePosScanner). */
  elementId: string;
  /** Ref al botón toggle (para focus u otros). */
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Sección del scanner de código de barras del POS.
 *
 * Renderiza el botón toggle + viewfinder (con brackets decorativos y
 * scan-line). Las clases `.scanner-container-active` / `-inactive`
 * aplican la transición de max-height/opacity sin estilos inline.
 */
export function PosScannerSection({ active, onToggle, toggleRef, elementId }: Props) {
  return (
    <div className={styles["scanner-section"]}>
      <button
        ref={toggleRef}
        onClick={onToggle}
        className={`${styles["scanner-toggle-btn"]} ${active ? styles["scanner-toggle-btn-active"] : ""}`}
        title={active ? "Desactivar escáner" : "Activar escáner de código de barras"}
      >
        <ScanBarcode size={18} />
      </button>

      <div
        className={`${styles["scanner-container"]} ${active ? styles["scanner-container-active"] : styles["scanner-container-inactive"]}`}
      >
        <div className={styles["scanner-camera-wrap"]}>
          <div id={elementId} className={styles["scanner-viewfinder"]} />
          <div className={styles["scanner-overlay-brackets"]} />
          <div className={styles["scanner-overlay-line"]} />
        </div>
      </div>
    </div>
  );
}
