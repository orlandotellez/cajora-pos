import { Outlet } from "react-router-dom";
import { Shield } from "lucide-react";
import { useSuperAdminGuard } from "@/hooks/useSuperAdminGuard";
import styles from "./SuperAdmin.module.css";

export default function SuperAdminLayout() {
  useSuperAdminGuard();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>
              <Shield size={18} />
            </span>
            <h1 className={styles.title}>Panel Super Admin</h1>
          </div>
          <p className={styles.subtitle}>Vista global de todas las tiendas y sus métricas</p>
        </div>
      </div>

      {/* Contenido de la página hija */}
      <Outlet />
    </div>
  );
}
