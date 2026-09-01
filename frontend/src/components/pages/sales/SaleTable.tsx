import { money } from "@/lib/format";
import { DataTable, type Column } from "@/components/common/DataTable";
import type { Sale } from "@/api";
import styles from "./SaleTable.module.css";

interface SaleTableProps {
  sales: Sale[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (sale: Sale) => void;
  dimmed?: boolean;
  refreshing?: boolean;
}

export function SaleTable({ sales, loading, total, page, totalPages, onPageChange, onView, dimmed, refreshing }: SaleTableProps) {
  const columns: Column<Sale>[] = [
    {
      key: "date",
      label: "Fecha",
      render: (s) => (
          <div>
            <div className={styles["sale-date"]}>{new Date(s.created_at).toLocaleDateString()}</div>
            <div className={styles["sale-time"]}>{new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      ),
    },
    {
      key: "client",
      label: "Cliente",
      render: (s) => (
        <span className={styles["sale-client"]}>
          {s.client_name ?? "—"}
        </span>
      ),
    },
    {
      key: "items",
      label: "Artículos",
      align: "right",
      render: (s) => <>{s.items?.length ?? "—"}</>,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
        render: (s) => <span className={styles["sale-total"]}>{money(s.total)}</span>,
    },
    {
      key: "payment",
      label: "Pago",
      render: (s) => {
        const colors: Record<string, { bg: string; fg: string }> = {
          efectivo: { bg: "rgba(34,197,94,0.1)", fg: "#16a34a" },
          tarjeta: { bg: "rgba(59,130,246,0.1)", fg: "#3b82f6" },
          transferencia: { bg: "rgba(139,92,246,0.1)", fg: "#8b5cf6" },
          credito: { bg: "rgba(245,158,11,0.1)", fg: "#d97706" },
        };
        const c = colors[s.payment_method] ?? { bg: "rgba(107,114,128,0.1)", fg: "#6b7280" };
        return (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: c.bg, color: c.fg }}>
            {s.payment_method}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={sales}
      loading={loading}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onView}
      onEdit={onView}
      emptyMessage="Sin ventas"
      skeletonCols={[{ width: "35%" }, { width: "15%", align: "right" }, { width: "20%", align: "right" }, { width: "20%" }, { width: "10%" }]}
      dimmed={dimmed}
      refreshing={refreshing}
    />
  );
}
