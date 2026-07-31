import { ChevronLeft, ChevronRight } from "lucide-react";
import { money } from "@/lib/format";
import type { Sale } from "@/api/sales";
import TableSkeleton from "@/components/common/TableSkeleton";
import styles from "./RecentSalesTable.module.css";

const SKELETON_COLS = [
  { width: "50%" },
  { width: "30%" },
  { width: "20%", align: "right" as const },
];

interface RecentSalesTableProps {
  sales: Sale[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function RecentSalesTable({ sales, loading, page, totalPages, onPageChange }: RecentSalesTableProps) {
  return (
    <section className={styles.recentCard}>
      <h2 className={styles.recentTitle}>Últimas ventas</h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Fecha</th>
              <th className={styles.thLeft}>Método</th>
              <th className={styles.thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.map((s) => (
                <tr key={s.id} className={`${styles.tr} ${loading ? styles.trDim : ""}`}>
                  <td className={styles.tdDate}>{new Date(s.created_at).toLocaleString("es-MX")}</td>
                  <td className={styles.tdMethod}>{s.payment_method}</td>
                  <td className={styles.tdRight}>{money(s.total)}</td>
                </tr>
              ))
            ) : loading ? (
              <TableSkeleton cols={SKELETON_COLS} rows={5} />
            ) : (
              <tr>
                <td colSpan={3} className={styles.empty}>Sin ventas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={styles.pageBtn}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`${styles.pageBtn} ${n === page ? styles.pageActive : ""}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={styles.pageBtn}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
