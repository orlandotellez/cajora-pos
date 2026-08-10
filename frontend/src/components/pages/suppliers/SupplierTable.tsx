import { useMemo } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Supplier } from "@/api";
import styles from "./SupplierTable.module.css";

interface SupplierTableProps {
  suppliers: Supplier[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function SupplierTable({ suppliers, loading, total, page, totalPages, onPageChange, onEdit, onDelete, dimmed, refreshing }: SupplierTableProps) {
  const columns: Column<Supplier>[] = useMemo(() => [
    { key: "name", label: "Nombre", render: (s) => <span className={styles["supplier-name"]}>{s.name}</span> },
    { key: "contact", label: "Contacto", render: (s) => <>{s.contact_name ?? "—"}</> },
    { key: "phone", label: "Teléfono", render: (s) => <>{s.phone ?? "—"}</> },
    { key: "email", label: "Email", render: (s) => <span className={styles["supplier-email"]}>{s.email ?? "—"}</span> },
    {
      key: "status", label: "Estado", render: (s) => (
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: s.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: s.is_active ? "#16a34a" : "#dc2626" }}>
          {s.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={suppliers}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyMessage="Sin proveedores"
      skeletonCols={[{ width: "30%" }, { width: "20%" }, { width: "15%" }, { width: "20%" }, { width: "10%" }, { width: "80px" }]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
