import { Plus } from "lucide-react";
import styles from "./Header.module.css";

interface HeaderProps {
  total: number;
  onNew: () => void;
  loading?: boolean;
}

export const Header = ({ total, onNew, loading = false }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Clientes</h1>
        <p className={styles.subtitle}>
          {loading && total === 0 ? (
            <span className={styles.skeleton} aria-hidden="true" />
          ) : (
            `${total} clientes registrados`
          )}
        </p>
      </div>
      <button onClick={onNew} className={styles.primaryBtn}>
        <Plus size={16} /> Nuevo cliente
      </button>
    </header>
  );
};
