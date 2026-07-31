import { Loader2 } from "lucide-react"
import styles from "./PrinterLoad.module.css"

export const PrinterLoad = () => {
  return (
    <>
      <div className={styles.printingOverlay}>
        <div className={styles.printingBox}>
          <Loader2 size={36} className={styles.spinner} />
          <span className={styles.printingText}>Imprimiendo…</span>
        </div>
      </div>
    </>
  )
}
