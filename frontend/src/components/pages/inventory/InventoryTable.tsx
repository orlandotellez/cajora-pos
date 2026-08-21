import { useMemo } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Product } from "@/api";
import { UNIT_TYPE_LABELS, unitQuantitySuffix } from "@/lib/constants";
import { money } from "@/lib/format";
import styles from "./InventoryTable.module.css";

interface InventoryTableProps {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onRowClick?: (product: Product) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function InventoryTable({ products, loading, total, page, totalPages, onPageChange, onEdit, onAdjust, onRowClick, dimmed, refreshing }: InventoryTableProps) {
  const columns: Column<Product>[] = useMemo(() => [
    {
      key: "name",
      label: "Producto",
      render: (p) => (
          <div>
            <div className={styles["inventory-name"]}>{p.name}</div>
            {p.barcode && <div className={styles["inventory-barcode"]}>{p.barcode}</div>}
          </div>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      align: "right",
      render: (p) => {
        const color = p.stock <= 0 ? "#ef4444" : p.stock <= p.low_stock_threshold ? "#f59e0b" : "var(--foreground)";
        return (
          <span style={{ color, fontWeight: color !== "var(--foreground)" ? 600 : 400 }}>
            {p.stock}
            {p.unit_type && (
              <span className={styles["inventory-unitBadge"]}>
                {UNIT_TYPE_LABELS[p.unit_type] || p.unit_type}
                {unitQuantitySuffix(p.unit_type, p.unit_quantity)}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "price",
      label: "Precio",
      align: "right",
      render: (p) => <span className={styles["inventory-money"]}>{money(p.price)}</span>,
    },
    {
      key: "cost",
      label: "Costo",
      align: "right",
      render: (p) => <span className={styles["inventory-money"]}>{money(p.cost)}</span>,
    },
    {
      key: "threshold",
      label: "Umbral",
      align: "right",
        render: (p) => <span className={styles["inventory-threshold"]}>{p.low_stock_threshold}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) => (
        <div className={styles["inventory-actions"]}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(p); }}
            className={`${styles["inventory-btn"]} ${styles["inventory-btnPrimary"]}`}
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjust(p); }}
            className={styles["inventory-btn"]}
          >
            Ajustar
          </button>
        </div>
      ),
    },
  ], [onEdit, onAdjust]);

  return (
    <DataTable
      columns={columns}
      data={products}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      emptyMessage="Sin productos"
      skeletonCols={[
        { width: "40%" },
        { width: "16%", align: "right" },
        { width: "12%", align: "right" },
        { width: "12%", align: "right" },
        { width: "10%", align: "right" },
        { width: "100px", align: "center" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
