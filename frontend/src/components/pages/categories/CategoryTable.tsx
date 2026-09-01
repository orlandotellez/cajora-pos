import { useMemo } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Category } from "@/api/categories";
import styles from "./CategoryTable.module.css";

interface CategoryTableProps {
  categories: Category[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  dimmed?: boolean;
  refreshing?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function CategoryTable({
  categories,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  dimmed,
  refreshing,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: CategoryTableProps) {
  const columns: Column<Category>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Nombre",
        render: (c) => (
          <div>
            <div className={styles["category-name"]}>{c.name}</div>
            {typeof c.product_count === "number" && (
              <div className={styles["category-meta"]}>
                {c.product_count} producto{c.product_count !== 1 ? "s" : ""} asociado{c.product_count !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "description",
        label: "Descripción",
        render: (c) => <span className={styles["category-desc"]}>{c.description || "—"}</span>,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={categories}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage="Sin categorías"
      skeletonCols={[{ width: "30%" }, { width: "50%" }, { width: "80px" }]}
      dimmed={dimmed}
      refreshing={refreshing}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}
