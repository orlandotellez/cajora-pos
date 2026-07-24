import { Link, useLocation } from "react-router-dom";
import { type ReactNode, useState, useEffect, useCallback } from "react";
import { ScanBarcode, Package, Wrench, BarChart3, Settings, Boxes, Users, Moon, Sun, Receipt, Truck, Menu, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { UserMenu } from "./UserMenu";
import logoDark from "@/assets/logo_dark.svg";
import logoLight from "@/assets/logo_light.svg";
import styles from "./AppShell.module.css";

const sharedNavItems = [
  { to: "/pos", label: "Venta", icon: ScanBarcode },
  { to: "/products", label: "Productos", icon: Package },
  { to: "/services", label: "Servicios", icon: Wrench },
  { to: "/suppliers", label: "Proveedores", icon: Truck },
  { to: "/inventory", label: "Inventario", icon: Boxes },
  { to: "/sales", label: "Ventas", icon: Receipt },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
];

const adminNavItems = [
  { to: "/settings", label: "Ajustes", icon: Settings },
  { to: "/users", label: "Usuarios", icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const isAdmin = user?.role === "admin";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = isAdmin ? [...sharedNavItems, ...adminNavItems] : sharedNavItems;

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
            <span className={styles.logoText}>Sistema POS</span>
          </div>
          <div className={styles.logoRole}>{user?.role === "admin" ? "Administrador" : "Cajero"}</div>
        </div>
        <nav className={styles.nav}>
          {navItems.map((it) => {
            const Icon = it.icon;
            const active = pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                <Icon className={styles.navIcon} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
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
      <aside className={`${styles.drawer} ${mobileMenuOpen ? styles.drawerOpen : ""}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.logoTop}>
            <img
              src={theme === "dark" ? logoLight : logoDark}
              alt="Logo"
              className={styles.logoImg}
            />
            <span className={styles.logoText}>Sistema POS</span>
          </div>
          <button
            className={styles.drawerCloseBtn}
            onClick={closeDrawer}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.drawerRole}>
          {user?.role === "admin" ? "Administrador" : "Cajero"}
        </div>

        <nav className={styles.drawerNav}>
          {navItems.map((it) => {
            const Icon = it.icon;
            const active = pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`${styles.drawerNavItem} ${active ? styles.drawerNavItemActive : ""}`}
              >
                <Icon className={styles.drawerNavIcon} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.drawerFooter}>
          <button onClick={toggle} className={styles.drawerThemeBtn}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <UserMenu />
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
