import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import TableSkeleton, { type SkeletonCol } from "@/components/common/TableSkeleton";
import styles from "./DataTable.module.css";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  emptyMessage?: string;
  skeletonCols?: SkeletonCol[];
  rowClassName?: (item: T) => string | undefined;
  dimmed?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete,
  emptyMessage = "Sin datos",
  skeletonCols,
  rowClassName,
  dimmed,
}: DataTableProps<T>) {
  const hasEditDelete = onEdit || onDelete;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: col.align ?? "left",
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
              {hasEditDelete && (
                <th className={styles.thActions}></th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={skeletonCols ?? columns.map(() => ({ width: "auto" }))} />
            ) : data.length > 0 ? (
              data.map((item) => (
                <tr
                  key={item.id}
                  className={`${onRowClick ? styles.trClickable : ""} ${dimmed ? styles.trDim : ""} ${rowClassName?.(item) ?? ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        textAlign: col.align ?? "left",
                        padding: "10px 16px",
                        fontSize: 13,
                      }}
                    >
                      {col.render(item)}
                    </td>
                  ))}
                  {hasEditDelete && (
                    <td className={styles.tdActions}>
                      {onEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                          className={styles.iconBtn}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                          className={`${styles.iconBtn} ${styles.iconDanger}`}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (hasEditDelete ? 1 : 0)} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => onPageChange(page - 1)}
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
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={styles.pageBtn}
          >
            <ChevronRight size={16} />
          </button>
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
