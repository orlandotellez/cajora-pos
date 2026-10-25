import { Image as ImageIcon } from "lucide-react";
import styles from "./ProductThumb.module.css";

interface ProductThumbProps {
  size?: number;
}

export function ProductThumb({ size = 40 }: ProductThumbProps) {
  return (
    <span className={styles.thumb} style={{ width: size, height: size }}>
      <ImageIcon size={Math.round(size * 0.42)} />
    </span>
  );
}
