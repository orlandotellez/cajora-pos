import { useMemo } from "react";
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
              borderRadius: 4,
              background: s.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: s.is_active ? "#16a34a" : "#dc2626",
            }}
          >
            {s.is_active ? "Activo" : "Inactivo"}
          </span>
        ),
      },
    ],
    [],
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
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage="Sin servicios"
      skeletonCols={[
        { width: "30%" },
        { width: "35%" },
        { width: "20%", align: "right" },
        { width: "15%" },
        { width: "80px" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
