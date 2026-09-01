import { ScanBarcode } from "lucide-react";
import type { RefObject } from "react";
import styles from "./PosScannerSection.module.css";

interface Props {
  active: boolean;
  onToggle: () => void;
  elementId: string;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

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
        </div>
      </div>
    </div>
  );
}
