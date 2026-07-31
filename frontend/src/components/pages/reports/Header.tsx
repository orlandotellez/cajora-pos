import styles from "./Header.module.css";

export type Range = "today" | "week" | "month";

interface HeaderProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  loading?: boolean;
}

export function Header({ range, onRangeChange, loading = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Reportes</h1>
        <p className={styles.subtitle}>Resumen de ventas y productos</p>
      </div>
      {loading ? (
        <div className={`${styles.select} ${styles.skeletonBar} ${styles["skeleton-header"]}`} />
      ) : (
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as Range)}
          className={styles.select}
        >
          <option value="today">Hoy</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Últimos 30 días</option>
        </select>
      )}
    </header>
  );
}
