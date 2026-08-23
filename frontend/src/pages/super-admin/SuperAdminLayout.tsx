import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Store,
  Users,
  Clock,
  Shield,
} from "lucide-react";
import { useSuperAdminGuard } from "@/hooks/useSuperAdminGuard";
import styles from "./SuperAdmin.module.css";

const tabs = [
  { to: "/super-admin", label: "Panel Global", icon: LayoutDashboard, end: true },
  { to: "/super-admin/subscriptions", label: "Suscripciones", icon: CreditCard },
  { to: "/super-admin/stores", label: "Tiendas", icon: Store },
  { to: "/super-admin/users", label: "Usuarios", icon: Users },
  { to: "/super-admin/events", label: "Eventos", icon: Clock },
];

export default function SuperAdminLayout() {
  useSuperAdminGuard();
  const location = useLocation();

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

      {/* Tabs de navegación */}
      <nav className={styles.tabNav}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.end
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <Icon size={15} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Contenido de la página hija */}
      <Outlet />
    </div>
  );
}
