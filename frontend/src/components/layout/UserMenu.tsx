import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/common/ui/ConfirmDialog";
import styles from "./UserMenu.module.css";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

          {/* Ajustes es admin-only (igual que el grupo ADMINISTRACIÓN del sidebar).
              El divider va DENTRO del condicional para que un cajero no vea dos
              líneas divisorias consecutivas. */}
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
            </>
          )}

          <div className={styles.divider} />

          <button
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
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
        message="Estas seguro de que queres cerrar sesion?"
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
