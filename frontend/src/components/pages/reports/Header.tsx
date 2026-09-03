import { Download, Loader2 } from "lucide-react";
import type { Range } from "@/lib/date-range";
import styles from "./Header.module.css";

export type { Range };

interface HeaderProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  loading?: boolean;
  onExport?: () => void;
  exporting?: boolean;
}

export function Header({ range, onRangeChange, loading = false, onExport, exporting = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Reportes</h1>
        <p className={styles.subtitle}>Resumen de ventas y productos</p>
      </div>
      <div className={styles.headerActions}>
        {loading ? (
          <div className={`${styles.select} ${styles.skeletonBar} ${styles["skeleton-header"]}`} />
        ) : (
          <select
            value={range}
            onChange={(e) => onRangeChange(e.target.value as Range)}
            className={styles.select}
          >
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="1y">Último año</option>
          </select>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport || exporting}
          className={styles.exportBtn}
        >
          {exporting ? <Loader2 size={16} className={styles.spin} /> : <Download size={16} />}
          {exporting ? "Exportando…" : "Exportar a Excel"}
        </button>
      </div>
    </header>
  );
}
