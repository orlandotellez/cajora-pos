import { Plus } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  total: number;
  onNew: () => void;
}

export const Header = ({ total, onNew }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Proveedores</h1>
        <p className={styles.subtitle}>{total} proveedores registrados</p>
      </div>
      <button onClick={onNew} className={styles.primaryBtn}>
        <Plus size={16} /> Nuevo proveedor
      </button>
    </header>
  );
};
