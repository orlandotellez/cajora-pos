import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSettingsStore } from "@/store/settingsStore";
import { resolveMobileTabs } from "./navigation";
import styles from "./MobileTabBar.module.css";

/**
 * Barra de navegación inferior para móvil.
 *
 * Muestra los 4 módulos principales (POS primero) y deja el resto del menú en
 * el drawer del hamburguesa. En escritorio no se renderiza (CSS la oculta).
 */
export function MobileTabBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { has } = usePermissions();
  const cashRegisterEnabled = useSettingsStore((s) => s.cashRegisterEnabled);

  // El super admin no opera tiendas: navega solo con el drawer del panel global.
  if (user?.role === "super_admin") return null;

  const tabs = resolveMobileTabs({ has, cashRegisterEnabled });

  return (
    <nav className={styles.tabBar} aria-label="Navegación principal">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        // Activo en la ruta exacta o en cualquier sub-ruta, matcheando por
        // segmento para no marcar rutas hermanas (p. ej. /products-x).
        const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.tabIconWrap}>
              <Icon size={20} />
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
