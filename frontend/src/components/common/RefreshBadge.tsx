import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import styles from "./RefreshBadge.module.css";

const MIN_VISIBLE_MS = 500;

export function RefreshBadge({ refreshing }: { refreshing?: boolean }) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (refreshing) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setVisible(true);
    } else {
      hideTimer.current = setTimeout(() => setVisible(false), MIN_VISIBLE_MS);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [refreshing]);

  if (!visible) return null;

  return (
    <div className={styles.badge} role="status" aria-live="polite">
      <Loader2 size={13} className={styles.spinner} />
      <span>Actualizando…</span>
    </div>
  );
}
