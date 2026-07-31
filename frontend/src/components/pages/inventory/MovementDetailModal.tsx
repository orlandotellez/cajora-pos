import { X, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import type { InventoryMovement } from "@/api/inventory";
import styles from "./MovementDetailModal.module.css";

interface MovementDetailModalProps {
  movement: InventoryMovement;
  onClose: () => void;
}

export function MovementDetailModal({ movement, onClose }: MovementDetailModalProps) {
  return (
    <div className={styles.overlayCenter} onClick={onClose}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalle del movimiento</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Producto</span>
            <span className={styles.detailValue}>{movement.product_name ?? "—"}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Tipo</span>
            <span className={`${styles.movementBadge} ${styles[`movement_${movement.movement_type}`] ?? ""}`}>
              {movement.movement_type === "entrada" && <ArrowDownRight size={14} />}
              {movement.movement_type === "salida" && <ArrowUpRight size={14} />}
              {movement.movement_type === "ajuste" && <RefreshCw size={14} />}
              {movement.movement_type === "venta" && <ArrowUpRight size={14} />}
              {movement.movement_type === "entrada" && " Entrada"}
              {movement.movement_type === "salida" && " Salida"}
              {movement.movement_type === "ajuste" && " Ajuste"}
              {movement.movement_type === "venta" && " Venta"}
            </span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Cantidad</span>
            <span className={styles.detailValue}>
              {movement.movement_type === "entrada" || movement.movement_type === "venta" ? "+" : movement.movement_type === "salida" ? "−" : ""}
              {movement.quantity}
            </span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Fecha</span>
            <span className={styles.detailValue}>
              {new Date(movement.created_at).toLocaleString("es-MX")}
            </span>
          </div>
          {movement.note && (
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Nota</span>
              <p className={styles.detailNote}>{movement.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
