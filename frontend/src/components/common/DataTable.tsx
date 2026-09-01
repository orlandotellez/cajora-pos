import { type ReactNode } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import TableSkeleton, { type SkeletonCol } from "@/components/common/TableSkeleton";
import { RefreshBadge } from "@/components/common/RefreshBadge";
import { getVisiblePages } from "@/lib/pagination";
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
  refreshing?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
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
  refreshing,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const hasEditDelete = onEdit || onDelete;

  const pageIds = data.map((d) => d.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }

  function toggleSelect(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <div className={styles.tableCard}>
      <RefreshBadge refreshing={refreshing} />
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {selectable && (
                <th className={styles.thCheck}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Seleccionar todo"
                  />
                </th>
              )}
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
                  className={`${onRowClick && !selectable ? styles.trClickable : ""} ${dimmed ? styles.trDim : ""} ${selectedIds?.has(item.id) ? styles.trSelected : ""} ${rowClassName?.(item) ?? ""}`}
                  onClick={() => {
                    if (!selectable) onRowClick?.(item);
                  }}
                >
                  {selectable && (
                    <td className={styles.tdCheck}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(item.id) ?? false}
                        onChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Seleccionar ${item.id}`}
                      />
                    </td>
                  )}
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
                <td colSpan={columns.length + (hasEditDelete ? 1 : 0) + (selectable ? 1 : 0)} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {total} registro{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
          </span>
          <div className={styles.paginationButtons}>
            <button
              onClick={() => onPageChange(page - 1)}
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
              onClick={() => onPageChange(page + 1)}
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
