import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Settings, CreditCard, LogOut, Globe, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCashSessionStore } from "@/store/cashSessionStore";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import styles from "./UserMenu.module.css";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [cashOpenWarning, setCashOpenWarning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);


  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);


  const initials = user?.name
    ? user.name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className={styles.wrapper} ref={ref}>
      {}
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        type="button"
      >
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.name ?? "Usuario"}</div>
          <div className={styles.userEmail}>{user?.email}</div>
        </div>
        <ChevronDown
          size={14}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {}
      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownAvatar}>{initials}</div>
            <div>
              <div className={styles.dropdownName}>{user?.name}</div>
              <div className={styles.dropdownEmail}>{user?.email}</div>
            </div>
          </div>

          {user?.role === "admin" && (
            <>
              <div className={styles.divider} />
              <Link
                to="/settings"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Settings className={styles.menuItemIcon} />
                Ajustes
              </Link>
              {user?.is_owner && (
                <Link
                  to="/subscription"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <CreditCard className={styles.menuItemIcon} />
                  Suscripción
                </Link>
              )}
              <a
                href="https://cajorapos.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Globe className={styles.menuItemIcon} />
                Sitio web
                <ExternalLink size={11} style={{ marginLeft: "auto", opacity: 0.4 }} />
              </a>
            </>
          )}

          <div className={styles.divider} />

          <button
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              // Recordatorio de caja abierta: si el usuario tiene una sesión
              // de caja abierta, el diálogo de confirmación lo advierte.
              let hasOpen = false;
              try {
                await useCashSessionStore.getState().fetchStatus(true);
                hasOpen = useCashSessionStore.getState().hasOpenSessionFor(user?.id ?? "");
              } catch {
                // Si falla la consulta, salimos con el diálogo normal.
              }
              setCashOpenWarning(hasOpen);
              setShowLogoutConfirm(true);
            }}
          >
            <LogOut className={styles.menuItemIcon} />
            Cerrar sesion
          </button>
        </div>
      )}

      {}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Cerrar sesion"
        message={
          cashOpenWarning
            ? "Tenés una caja abierta. Si cerrás sesión no vas a poder cobrar en efectivo hasta que se abra de nuevo. ¿Seguro que querés salir?"
            : "Estas seguro de que queres cerrar sesion?"
        }
        confirmLabel="Si, salir"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
