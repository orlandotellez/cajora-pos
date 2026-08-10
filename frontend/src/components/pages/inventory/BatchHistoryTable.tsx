import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import type { BatchResponse } from "@/api/inventory";
import { RefreshBadge } from "@/components/common/RefreshBadge";
import styles from "./BatchHistoryTable.module.css";

interface BatchHistoryTableProps {
  batches: BatchResponse[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelect: (batch: BatchResponse) => void;
  refreshing?: boolean;
}

export function BatchHistoryTable({ batches, page, totalPages, onPageChange, onSelect, refreshing }: BatchHistoryTableProps) {
  return (
    <div className={styles.tableCard}>
      <RefreshBadge refreshing={refreshing} />
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Fecha</th>
              <th className={styles.thLeft}>Tipo</th>
              <th className={styles.thLeft}>Proveedor</th>
              <th className={styles.thRight}>Items</th>
              <th className={styles.thRight}>Total unidades</th>
              <th className={styles.thAction}></th>
            </tr>
          </thead>
          <tbody>
            {batches.length > 0 ? (
              batches.map((b) => (
                <tr key={b.id} className={styles.movementRow} onClick={() => onSelect(b)}>
                  <td className={styles.tdProduct}>
                    {new Date(b.created_at).toLocaleString("es-MX", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className={styles.tdLeft}>
                    <span className={`${styles.movementBadge} ${styles[`movement_${b.movement_type}`] ?? ""}`}>
                      {b.movement_type === "entrada" && " Entrada"}
                      {b.movement_type === "salida" && " Salida"}
                      {b.movement_type === "ajuste" && " Ajuste"}
                    </span>
                  </td>
                  <td className={styles.tdLeft}>{b.supplier_name ?? "—"}</td>
                  <td className={styles.tdRight}>{b.total_items}</td>
                  <td className={styles.tdRight}>{b.total_quantity}</td>
                  <td className={styles.tdActions}><Eye size={14} className={styles.eyeIcon} /></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className={styles.empty}>Sin movimientos agrupados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={styles.pageBtn}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`${styles.pageBtn} ${n === page ? styles.pageActive : ""}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={styles.pageBtn}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
