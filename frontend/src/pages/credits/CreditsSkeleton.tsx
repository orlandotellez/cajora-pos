import styles from "./CreditsSkeleton.module.css";

export function CreditsSkeleton() {
  return (
    <>
      <div className={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <span className={`${styles.skeleton} ${styles.statLabel}`} style={{ width: "60%" }} aria-hidden="true" />
            <span className={`${styles.skeleton} ${styles.statValue}`} style={{ width: "45%" }} aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className={styles.tabs}>
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={styles.skeleton} style={{ width: 72, height: 20 }} aria-hidden="true" />
        ))}
      </div>

      <div className={styles.list}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.clientCard}>
            <div className={styles.clientInfo}>
              <span className={styles.skeleton} style={{ width: `${38 + (i % 3) * 8}%`, height: 14 }} aria-hidden="true" />
              <span className={styles.skeleton} style={{ width: "28%", height: 11 }} aria-hidden="true" />
            </div>
            <div className={styles.clientDebt}>
              <span className={styles.skeleton} style={{ width: "70px", height: 15 }} aria-hidden="true" />
              <span className={styles.skeleton} style={{ width: "44px", height: 11 }} aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
