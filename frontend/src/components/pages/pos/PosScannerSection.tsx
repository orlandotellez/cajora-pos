import { ScanBarcode, X } from "lucide-react";
import type { RefObject } from "react";
import styles from "./PosScannerSection.module.css";

interface Props {
  active: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  elementId: string;
  toggleRef: RefObject<HTMLButtonElement | null>;
  error?: string | null;
}

export function PosScannerSection({ active, onToggle, onDismiss, toggleRef, elementId, error }: Props) {
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

      {error && (
        <div className={styles["scanner-error"]} role="alert">
          <span className={styles["scanner-error-text"]}>{error}</span>
          {onDismiss && (
            <button
              className={styles["scanner-error-close"]}
              onClick={onDismiss}
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div
        className={`${styles["scanner-container"]} ${active ? styles["scanner-container-active"] : styles["scanner-container-inactive"]}`}
      >
        <div className={styles["scanner-camera-wrap"]}>
          <div id={elementId} className={styles["scanner-viewfinder"]} />
          <div className={styles["scanner-overlay-brackets"]} />
        </div>
      </div>
    </div>
  );
}
