import { useMemo } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Product } from "@/api";
import styles from "./InventoryTable.module.css";

interface InventoryTableProps {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAdjust: (product: Product) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function InventoryTable({ products, loading, total, page, totalPages, onPageChange, onAdjust, dimmed, refreshing }: InventoryTableProps) {
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
        return <span style={{ color, fontWeight: color !== "var(--foreground)" ? 600 : 400 }}>{p.stock}</span>;
      },
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
        <button
          onClick={(e) => { e.stopPropagation(); onAdjust(p); }}
          className={styles["inventory-btn"]}
        >
          Ajustar
        </button>
      ),
    },
  ], [onAdjust]);

  return (
    <DataTable
      columns={columns}
      data={products}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage="Sin productos"
      skeletonCols={[
        { width: "55%" },
        { width: "20%", align: "right" },
        { width: "20%", align: "right" },
        { width: "100px", align: "center" },
      ]}
      onRowClick={onAdjust}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
