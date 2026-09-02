import { Loader2, ArrowDownRight, ArrowUpRight, RefreshCw, Eye } from "lucide-react";
import type { InventoryMovement } from "@/api/inventory";
import { MOVEMENT_TYPES, UNIT_TYPE_LABELS, unitQuantitySuffix } from "@/lib/constants";
import { RefreshBadge } from "@/components/common/RefreshBadge";
import { getVisiblePages } from "@/lib/pagination";
import styles from "./MovementHistoryTable.module.css";

interface MovementHistoryTableProps {
  movements: InventoryMovement[];
  page: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSelect: (movement: InventoryMovement) => void;
  refreshing?: boolean;
}

export function MovementHistoryTable({ movements, page, totalPages, loading = false, onPageChange, onSelect, refreshing }: MovementHistoryTableProps) {
  return (
    <div className={styles.tableCard}>
      <RefreshBadge refreshing={refreshing} />
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Producto</th>
              <th className={styles.thLeft}>Tipo</th>
              <th className={styles.thRight}>Cantidad</th>
              <th className={styles.thRight}>Fecha</th>
              <th className={styles.thAction}></th>
            </tr>
          </thead>
          <tbody>
            {movements.length > 0 ? (
              movements.map((m) => (
                <tr key={m.id} className={styles.movementRow} onClick={() => onSelect(m)}>
                  <td className={styles.tdProduct}>{m.product_name ?? "—"}</td>
                  <td className={styles.tdLeft}>
                    <span className={`${styles.movementBadge} ${styles[`movement_${m.movement_type}`] ?? ""}`}>
                      {m.movement_type === "entrada" && <ArrowDownRight size={14} />}
                      {m.movement_type === "salida" && <ArrowUpRight size={14} />}
                      {m.movement_type === "ajuste" && <RefreshCw size={14} />}
                      {m.movement_type === "venta" && <ArrowUpRight size={14} />}
                      {m.movement_type === "entrada" && " Entrada"}
                      {m.movement_type === "salida" && " Salida"}
                      {m.movement_type === "ajuste" && " Ajuste"}
                      {m.movement_type === "venta" && " Venta"}
                      {!MOVEMENT_TYPES.includes(m.movement_type as typeof MOVEMENT_TYPES[number]) && m.movement_type}
                    </span>
                  </td>
                  <td className={`${styles.tdRight} ${styles.movementQty}`}>
                    {m.movement_type === "entrada" || m.movement_type === "venta" ? "+" : m.movement_type === "salida" ? "−" : ""}
                    {m.quantity}
                    {m.unit_type && (
                      <span className={styles.unitTypeBadge}>
                        {UNIT_TYPE_LABELS[m.unit_type] || m.unit_type}
                        {unitQuantitySuffix(m.unit_type, m.unit_quantity)}
                      </span>
                    )}
                  </td>
                  <td className={styles.tdRightMuted}>
                    {new Date(m.created_at).toLocaleString("es-MX", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className={styles.tdActions}>
                    <Eye size={14} className={styles.eyeIcon} />
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className={styles.empty}>Sin movimientos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationButtons}>
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={styles.pageBtn}
            >
              Anterior
            </button>
            {getVisiblePages(page, totalPages).map((item, idx) =>
              item === "dots" ? (
                <span key={`dots-${idx}`} className={styles.paginationDots}>…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={`${styles.pageBtn} ${item === page ? styles.pageActive : ""}`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={styles.pageBtn}
            >
              Siguiente
            </button>
          </div>
          {loading && (
            <Loader2
              size={14}
              className={styles.spinner}
              aria-label="Cargando"
              role="status"
            />
          )}
        </div>
      )}
    </div>
  );
}
