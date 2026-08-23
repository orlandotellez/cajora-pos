import {
  Crown,
  Shield,
  ShieldOff,
  UserX,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  PauseCircle,
  AlertCircle,
} from "lucide-react";
import type { SuperAdminStoreUser } from "@/api/super-admin";
import styles from "./SuperAdmin.module.css";

export function RoleBadge({ role }: { role: string }) {
  const isSuper = role === "super_admin";
  const isAdmin = role === "admin";
  const Icon = isSuper ? Crown : isAdmin ? Shield : ShieldOff;
  const cls = isSuper ? styles.roleSuper : isAdmin ? styles.roleAdmin : styles.roleCashier;
  return (
    <span className={`${styles.roleBadge} ${cls}`}>
      <Icon size={12} />
      {isSuper ? "Super Admin" : isAdmin ? "Admin" : "Cajero"}
    </span>
  );
}

export function UserStatusBadge({ user }: { user: SuperAdminStoreUser }) {
  if (user.deleted_at) {
    return (
      <span className={`${styles.statusBadge} ${styles.statusDeleted}`}>
        <UserX size={11} />
        Eliminado
      </span>
    );
  }
  if (user.email_verified) {
    return (
      <span className={`${styles.statusBadge} ${styles.statusVerified}`}>
        <CheckCircle2 size={11} />
        Verificado
      </span>
    );
  }
  return (
    <span className={`${styles.statusBadge} ${styles.statusUnverified}`}>
      <AlertTriangle size={11} />
      Sin verificar
    </span>
  );
}

export function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    active: { label: "Activa", cls: styles.subActive, icon: CheckCircle2 },
    past_due: { label: "Pago fallido", cls: styles.subPastDue, icon: AlertTriangle },
    canceled: { label: "Cancelada", cls: styles.subCanceled, icon: XCircle },
    expired: { label: "Expirada", cls: styles.subExpired, icon: PauseCircle },
    pending: { label: "Pendiente", cls: styles.subPending, icon: Clock },
  };
  const def = map[status] ?? { label: status, cls: "", icon: AlertCircle };
  const Icon = def.icon;
  return (
    <span className={`${styles.subBadge} ${def.cls}`}>
      <Icon size={11} />
      {def.label}
    </span>
  );
}
