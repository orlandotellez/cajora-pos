import { useMemo } from "react";
import { Shield, ShieldOff, Crown, UserCheck, UserX } from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { UserResponse } from "@/api";
import styles from "./UserTable.module.css";

interface UserTableProps {
  users: UserResponse[];
  currentUserId?: string;
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (user: UserResponse) => void;
  onDelete: (user: UserResponse) => void;
  onToggleActive: (user: UserResponse) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function UserTable({ users, currentUserId, loading, total, page, totalPages, onPageChange, onEdit, onDelete, onToggleActive, dimmed, refreshing }: UserTableProps) {
  const columns: Column<UserResponse>[] = useMemo(() => [
    {
      key: "name", label: "Nombre", render: (u) => (
        <div className={styles["user-cell"]}>
          <span className={styles["user-name"]}>{u.name}</span>
          {u.is_owner && <span className={styles["owner-badge"]}><Crown size={10} /> Propietario</span>}
          {u.id === currentUserId && <span className={styles["user-badge"]}>Tú</span>}
        </div>
      ),
    },
    { key: "email", label: "Email", render: (u) => <span className={styles["user-email"]}>{u.email}</span> },
    {
      key: "role", label: "Rol", render: (u) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: u.role === "admin" ? "rgba(139,92,246,0.1)" : "rgba(59,130,246,0.1)", color: u.role === "admin" ? "#8b5cf6" : "#3b82f6" }}>
          {u.role === "admin" ? <Shield size={12} /> : <ShieldOff size={12} />}
          {u.role === "admin" ? "Admin" : "Cajero"}
        </span>
      ),
    },
    {
      key: "is_active", label: "Estado", align: "center", render: (u) => (
        <button
          className={`${styles["status-toggle"]} ${u.is_active ? styles["status-active"] : styles["status-inactive"]}`}
          onClick={(e) => { e.stopPropagation(); onToggleActive(u); }}
          title={u.is_active ? "Desactivar usuario" : "Activar usuario"}
        >
          {u.is_active ? <UserCheck size={13} /> : <UserX size={13} />}
          {u.is_active ? "Activo" : "Inactivo"}
        </button>
      ),
    },
    { key: "created_at", label: "Creado", align: "right", render: (u) => <span className={styles["user-date"]}>{new Date(u.created_at).toLocaleDateString()}</span> },
  ], [currentUserId, onToggleActive]);

  return (
    <DataTable
      columns={columns}
      data={users}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onEdit}
      onEdit={onEdit}
      onDelete={(u) => { if (u.id !== currentUserId) onDelete(u); }}
      emptyMessage="Sin usuarios"
      skeletonCols={[{ width: "35%" }, { width: "35%" }, { width: "15%" }, { width: "10%", align: "right" }, { width: "80px" }]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
