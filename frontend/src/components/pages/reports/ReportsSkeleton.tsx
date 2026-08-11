import { Header, type Range } from "./Header";
import styles from "./ReportsSkeleton.module.css";

interface ReportsSkeletonProps {
  range: Range;
  onRangeChange: (range: Range) => void;
}

export function ReportsSkeleton({ range, onRangeChange }: ReportsSkeletonProps) {
  return (
    <>
      <Header range={range} onRangeChange={onRangeChange} loading />

      <div className={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <div className={`${styles.skeletonBar} ${styles["skeleton-stat-up"]}`} />
            <div className={`${styles.skeletonBar} ${styles["skeleton-stat-down"]}`} />
          </div>
        ))}
      </div>

      <div className={styles.twoCol}>
        <div className={styles.card}>
          <div className={`${styles.skeletonBar} ${styles["skeleton-card-title"]}`} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.skeletonBar} ${styles["skeleton-card-line"]}`} />
          ))}
        </div>
        <div className={styles.card}>
          <div className={styles.skeletonBar} style={{ width: "50%", height: 16, marginBottom: 16 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} style={{ width: `${50 + i * 8}%`, height: 14, marginBottom: 8 }} />
          ))}
        </div>
      </div>

    </>
  );
}
