import { X, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import type { BatchResponse } from "@/api/inventory";
import styles from "../../../pages/inventory/Inventory.module.css";

interface BatchDetailModalProps {
  batch: BatchResponse;
  onClose: () => void;
}

export function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  return (
    <div className={styles.overlayCenter} onClick={onClose}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalle del movimiento agrupado</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Tipo</span>
            <span className={`${styles.movementBadge} ${styles[`movement_${batch.movement_type}`] ?? ""}`}>
              {batch.movement_type === "entrada" && <ArrowDownRight size={14} />}
              {batch.movement_type === "salida" && <ArrowUpRight size={14} />}
              {batch.movement_type === "ajuste" && <RefreshCw size={14} />}
              {batch.movement_type === "entrada" && " Entrada"}
              {batch.movement_type === "salida" && " Salida"}
              {batch.movement_type === "ajuste" && " Ajuste"}
            </span>
          </div>
          {batch.supplier_name && (
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Proveedor</span>
              <span className={styles.detailValue}>{batch.supplier_name}</span>
            </div>
          )}
          {batch.user_name && (
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Usuario</span>
              <span className={styles.detailValue}>{batch.user_name}</span>
            </div>
          )}
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Fecha</span>
            <span className={styles.detailValue}>{new Date(batch.created_at).toLocaleString("es-MX")}</span>
          </div>
          {batch.notes && (
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Notas</span>
              <p className={styles.detailNote}>{batch.notes}</p>
            </div>
          )}

          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Productos ({batch.total_items})</span>
            <table className={styles.batchDetailTable}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className={styles.thRight}>Cantidad</th>
                  <th className={styles.thRight}>Costo unit.</th>
                </tr>
              </thead>
              <tbody>
                {(batch.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name ?? "—"}</td>
                    <td className={styles.tdRight}>{item.quantity}</td>
                    <td className={styles.tdRight}>{item.unit_cost != null ? `$${Number(item.unit_cost).toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.batchDetailHint}>
            Los movimientos individuales de este lote están disponibles en el historial general.
          </p>
        </div>
      </div>
    </div>
  );
}
