import { useMemo } from "react";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Product } from "@/api";
import styles from "./ProductTable.module.css";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function ProductTable({
  products,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  dimmed,
  refreshing,
}: ProductTableProps) {
  const columns: Column<Product>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Producto",
        render: (p) => (
          <div>
            <div className={styles["product-name"]}>{p.name}</div>
            <div className={styles["product-meta"]}>
              {p.category && <span>{p.category.name}</span>}
              {p.unit_type && (
                <span>
                  {" · "}
                  {UNIT_TYPE_LABELS[p.unit_type] || p.unit_type}
                  {p.unit_quantity ? ` ${p.unit_quantity}` : ""}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "price",
        label: "Precio",
        align: "right",
        render: (p) => <span className={styles["product-price"]}>{money(p.price)}</span>,
      },
      {
        key: "stock",
        label: "Stock",
        align: "right",
        render: (p) => (
          <span
            style={{
              color:
                p.stock <= 0
                  ? "#ef4444"
                  : p.stock <= p.low_stock_threshold
                    ? "#f59e0b"
                    : "var(--foreground, #111827)",
              fontWeight: p.stock <= p.low_stock_threshold ? 600 : 400,
            }}
          >
            {p.stock}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={products}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage="Sin productos"
      skeletonCols={[
        { width: "55%" },
        { width: "20%", align: "right" },
        { width: "20%", align: "right" },
        { width: "80px" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
