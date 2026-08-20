import { useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { DataTable, type Column } from "@/components/common/DataTable";
import { usePosStore } from "@/store/posStore";
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
  onAddToCart?: (product: Product) => void;
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
  onAddToCart,
  dimmed,
  refreshing,
}: ProductTableProps) {
  const cart = usePosStore((s) => s.cart);

  // Cantidad por producto ya agregada a la lista de venta.
  const cartQty = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      if (item._type === "product") map[item.id] = item.quantity;
    }
    return map;
  }, [cart]);

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
            {p.unit_type && (
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)", marginLeft: 3 }}>
                {UNIT_TYPE_LABELS[p.unit_type] || p.unit_type}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "add",
        label: "Agregar",
        align: "right",
        width: "110px",
        render: (p) => {
          // Bloqueado (visual) cuando no queda stock para una unidad más:
          // sin existencias o la cantidad en lista ya alcanzó el stock.
          // Se mantiene clickeable a propósito para mostrar el toast de error.
          const inCartQty = cartQty[p.id] ?? 0;
          const blocked = p.stock <= 0 || inCartQty >= p.stock;
          return (
            <button
              className={[
                styles["add-btn"],
                blocked ? styles["add-btn-blocked"] : "",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(p);
              }}
              title={blocked ? "Stock insuficiente" : "Agregar a la lista de venta"}
            >
              <ShoppingCart size={13} />
              Agregar
            </button>
          );
        },
      },
    ],
    [cartQty],
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
        { width: "50%" },
        { width: "18%", align: "right" },
        { width: "18%", align: "right" },
        { width: "110px" },
        { width: "80px" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
