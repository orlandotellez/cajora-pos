import { ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePosStore } from "@/store/posStore";
import styles from "./CartIndicator.module.css";

export function CartIndicator() {
  const navigate = useNavigate();
  const cartCount = usePosStore((s) => s.cart.reduce((acc, item) => acc + item.quantity, 0));

  if (cartCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/pos")}
      className={styles.cartBtn}
      title="Ver lista de venta"
    >
      <ShoppingCart size={16} />
      <span className={styles.cartLabel}>Lista de venta</span>
      <span className={styles.cartCount}>{cartCount}</span>
    </button>
  );
}
