import { useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { money } from "@/lib/format";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Service } from "@/api";
import styles from "./ServiceTable.module.css";

interface ServiceTableProps {
  services: Service[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onAddToCart?: (service: Service) => void;
  /** Si se define, se usa para el click en la fila (separado de onEdit). */
  onRowClick?: (service: Service) => void;
  blockedIds?: Set<string>;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function ServiceTable({
  services,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onAddToCart,
  onRowClick,
  blockedIds,
  dimmed,
  refreshing,
}: ServiceTableProps) {
  const columns: Column<Service>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Servicio",
        render: (s) => (
          <div>
            <div className={styles["service-name"]}>{s.name}</div>
            <div className={styles["service-meta"]}>
              {s.products.length > 0 && (
                <span>
                  {s.products.length} producto{s.products.length !== 1 ? "s" : ""} asociado{s.products.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "description",
        label: "Descripción",
        render: (s) => <span className={styles["service-desc"]}>{s.description || "—"}</span>,
      },
      {
        key: "base_price",
        label: "Precio Base",
        align: "right",
        render: (s) => <span className={styles["service-price"]}>{money(s.base_price)}</span>,
      },
      {
        key: "status",
        label: "Estado",
        align: "center",
        render: (s) => (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 5,
              background: s.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: s.is_active ? "#16a34a" : "#dc2626",
            }}
          >
            {s.is_active ? "Activo" : "Inactivo"}
          </span>
        ),
      },
      {
        key: "add",
        label: "Agregar",
        align: "right",
        width: "110px",
        render: (s) => {
          const inactive = !s.is_active;
          // Bloqueado (visual) cuando los sub-productos no alcanzan para una
          // unidad más. Se mantiene clickeable a propósito: muestra el toast
          // de error con el detalle de stock.
          const blocked = (blockedIds?.has(s.id) ?? false) && !inactive;
          return (
            <button
              className={[
                styles["add-btn"],
                blocked ? styles["add-btn-blocked"] : "",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(s);
              }}
              disabled={inactive}
              title={
                inactive
                  ? "Servicio inactivo"
                  : blocked
                    ? "Stock insuficiente"
                    : "Agregar a la lista de venta"
              }
            >
              <ShoppingCart size={13} />
              Agregar
            </button>
          );
        },
      },
    ],
    [blockedIds],
  );

  return (
    <DataTable
      columns={columns}
      data={services}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick ?? onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage="Sin servicios"
      skeletonCols={[
        { width: "28%" },
        { width: "32%" },
        { width: "18%", align: "right" },
        { width: "12%" },
        { width: "110px" },
        { width: "80px" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
