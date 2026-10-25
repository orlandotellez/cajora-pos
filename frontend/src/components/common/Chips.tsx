import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Chips.module.css";

export function ChipScroller({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(160, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  }

  return (
    <div className={styles.chipsRow}>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => scroll(-1)}
        aria-label={`${label}: ver anteriores`}
      >
        <ChevronLeft size={16} />
      </button>
      <div className={styles.chips} ref={ref} role="group" aria-label={label}>
        {children}
      </div>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => scroll(1)}
        aria-label={`${label}: ver más`}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  ariaPressed,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaPressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ?? active}
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
    >
      {children}
    </button>
  );
}
