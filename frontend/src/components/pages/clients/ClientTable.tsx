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
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  dimmed?: boolean;
  refreshing?: boolean;
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
  dimmed,
  refreshing,
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
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
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
    />
  );
}
