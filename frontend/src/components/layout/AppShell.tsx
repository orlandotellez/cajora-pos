import { Link, useLocation, useNavigate } from "react-router-dom";
import { type ReactNode, useState, useEffect, useCallback } from "react";
import {
  ScanBarcode,
  Package,
  Wrench,
  BarChart3,
  Settings,
  Boxes,
  Users,
  Receipt,
  Truck,
  Tag,
  Globe,
  Menu,
  X,
  Moon,
  Sun,
  Download,
  UserCheck,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useUpdate } from "@/context/UpdateContext";
import { useAppVersion } from "@/hooks/useAppVersion";
import { UserMenu } from "./UserMenu";
import { PaywallOverlay } from "@/components/pages/auth/PaywallOverlay";
import logoDark from "@/assets/logo_dark.svg";
import logoLight from "@/assets/logo_light.svg";
import styles from "./AppShell.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface NavGroup {
  label: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "PUNTO DE VENTA",
    items: [{ to: "/pos", label: "Venta", icon: ScanBarcode }],
  },
  {
    label: "CATÁLOGO",
    items: [
      { to: "/products", label: "Productos", icon: Package },
      { to: "/services", label: "Servicios", icon: Wrench },
      { to: "/suppliers", label: "Proveedores", icon: Truck },
      { to: "/categories", label: "Categorías", icon: Tag },
      { to: "/clients", label: "Clientes", icon: UserCheck },
      { to: "/inventory", label: "Inventario", icon: Boxes },
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      { to: "/sales", label: "Ventas", icon: Receipt },
      { to: "/reports", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    adminOnly: true,
    items: [
      { to: "/settings", label: "Ajustes", icon: Settings },
      { to: "/users", label: "Usuarios", icon: Users },
    ],
  },
  {
    label: "SUPER ADMIN",
    superAdminOnly: true,
    items: [{ to: "/super-admin", label: "Panel Global", icon: Globe }],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { hasUpdate, openUpdatePrompt } = useUpdate();
  const appVersion = useAppVersion();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";
  const roleLabel =
    user?.role === "super_admin" ? "Super Admin" : user?.role === "admin" ? "Administrador" : "Cajero";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleGroups = navGroups.filter((g) => {
    // Super admin: solo el panel global. No opera ninguna tienda.
    if (isSuperAdmin) return !!g.superAdminOnly;
    return (!g.adminOnly || isAdmin) && !g.superAdminOnly;
  });

  // Super admin: cualquier ruta distinta al panel global → panel global.
  useEffect(() => {
    if (isSuperAdmin && pathname !== "/super-admin") {
      navigate("/super-admin", { replace: true });
    }
  }, [isSuperAdmin, pathname, navigate]);

  // Close drawer on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen, handleKeyDown]);

  // Close drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const closeDrawer = () => setMobileMenuOpen(false);

  if (isSuperAdmin && pathname !== "/super-admin") {
    return null;
  }

  const renderNav = (navItemClass: string, iconClass: string) =>
    visibleGroups.map((group) => (
      <div key={group.label} className={styles.navGroup}>
        <span className={styles.navSectionLabel}>{group.label}</span>
        {group.items.map((it) => {
          const Icon = it.icon;
          const active = pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`${navItemClass} ${active ? styles.navItemActive : ""}`}
            >
              <Icon className={iconClass} />
              {it.label}
            </Link>
          );
        })}
      </div>
    ));

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoTop}>
            <img
              src={theme === "dark" ? logoLight : logoDark}
              alt="Logo"
              className={styles.logoImg}
            />
            <div className={styles.logoInfo}>
              <span className={styles.logoText}>Cajora POS</span>
              {appVersion !== null && (
                <span className={styles.logoVersion}>v{appVersion}</span>
              )}
            </div>

          </div>
          <div className={styles.logoRole}>{roleLabel}</div>
        </div>
        <nav className={styles.nav}>
          {renderNav(styles.navItem, styles.navIcon)}
        </nav>
        <div className={styles.sidebarFooter}>
          {hasUpdate && (
            <button onClick={openUpdatePrompt} className={styles.updateBtn}>
              <Download size={16} />
              Actualizar app
            </button>
          )}
          <button onClick={toggle} className={styles.drawerThemeBtn}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <UserMenu />
        </div>
      </aside>

      {/* Mobile hamburger button */}
      <button
        className={styles.hamburgerBtn}
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div className={styles.drawerOverlay} onClick={closeDrawer} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`${styles.drawer} ${mobileMenuOpen ? styles.drawerOpen : ""}`}
      >
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.logoTop}>
              <img
                src={theme === "dark" ? logoLight : logoDark}
                alt="Logo"
                className={styles.logoImg}
              />
              <div className={styles.logoInfo}>
                <span className={styles.logoText}>Cajora POS</span>
                {appVersion !== null && (
                  <span className={styles.logoVersion}>v{appVersion}</span>
                )}
              </div>
            </div>
          </div>

          <button
            className={styles.drawerCloseBtn}
            onClick={closeDrawer}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.drawerRole}>{roleLabel}</div>

        <nav className={styles.drawerNav}>
          {renderNav(styles.drawerNavItem, styles.drawerNavIcon)}
        </nav>

        <div className={styles.drawerFooter}>
          {hasUpdate && (
            <button onClick={openUpdatePrompt} className={styles.updateBtn}>
              <Download size={16} />
              Actualizar app
            </button>
          )}
          <button onClick={toggle} className={styles.drawerThemeBtn}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <UserMenu />
        </div>
      </aside>

      <main className={styles.main}>{children}</main>

      {/* Muro de pago global: se muestra sobre cualquier pantalla cuando el
          backend responde 402 Payment Required (suscripción Cloud no activa). */}
      <PaywallOverlay />
    </div>
  );
}
