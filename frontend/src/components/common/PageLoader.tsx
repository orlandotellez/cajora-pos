import { Loader2 } from "lucide-react";
import styles from "./PageLoader.module.css";

export function PageLoader() {
  return (
    <div className={styles.wrapper} role="status" aria-label="Cargando">
      <Loader2 size={28} className={styles.spinner} />
    </div>
  );
}
