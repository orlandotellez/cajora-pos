import { Plus } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  total: number;
  onNew: () => void;
}

export function Header({ total, onNew }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Usuarios</h1>
        <p className={styles.subtitle}>{total} usuario(s) en el sistema</p>
      </div>
      <button onClick={onNew} className={styles.primaryBtn}>
        <Plus size={16} /> Nuevo
      </button>
    </header>
  );
}
