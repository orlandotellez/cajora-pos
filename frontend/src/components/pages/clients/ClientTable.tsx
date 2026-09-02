import { useMemo } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Client } from "@/api";
import styles from "./ClientTable.module.css";

interface ClientTableProps {
  clients: Client[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Si se define, muestra un botón de editar por fila. */
  onEdit?: (client: Client) => void;
  /** Si se define, muestra un botón de eliminar por fila. */
  onDelete?: (client: Client) => void;
  /** Si se define, se usa para el click en la fila (separado de onEdit). */
  onRowClick?: (client: Client) => void;
  dimmed?: boolean;
  refreshing?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function ClientTable({
  clients,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onRowClick,
  dimmed,
  refreshing,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: ClientTableProps) {
  const columns: Column<Client>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Nombre",
        render: (c) => <span className={styles["client-name"]}>{c.name}</span>,
      },
      {
        key: "phone",
        label: "Teléfono",
        render: (c) => <>{c.phone ?? "—"}</>,
      },
      {
        key: "email",
        label: "Email",
        render: (c) => (
          <span className={styles["client-email"]}>{c.email ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Estado",
        render: (c) => (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 5,
              background: c.is_active
                ? "rgba(34,197,94,0.1)"
                : "rgba(239,68,68,0.1)",
              color: c.is_active ? "#16a34a" : "#dc2626",
            }}
          >
            {c.is_active ? "Activo" : "Inactivo"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={clients}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={selectable ? undefined : (onRowClick ?? onEdit)}
      onEdit={selectable ? undefined : onEdit}
      onDelete={selectable ? undefined : onDelete}
      emptyMessage="Sin clientes"
      skeletonCols={[
        { width: "30%" },
        { width: "20%" },
        { width: "25%" },
        { width: "10%" },
        { width: "80px" },
      ]}
      dimmed={dimmed}
      refreshing={refreshing}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}
