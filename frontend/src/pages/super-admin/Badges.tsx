import type { LucideIcon } from "lucide-react";
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

/**
 * Estados de suscripción: valor, etiqueta e icono en un solo lugar.
 *
 * Los comparten el badge y el select de estado. Antes cada uno tenía su propia
 * lista y sus propios emojis, así que una etiqueta nueva se veía distinta según
 * dónde apareciera.
 */
export const SUB_STATUS_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "active", label: "Activa", icon: CheckCircle2 },
  { value: "past_due", label: "Pago fallido", icon: AlertTriangle },
  { value: "pending", label: "Pendiente", icon: Clock },
  { value: "canceled", label: "Cancelada", icon: XCircle },
  { value: "expired", label: "Expirada", icon: PauseCircle },
];

/** Icono del estado de suscripción. Desconocido → AlertCircle. */
export function subStatusIcon(status: string): LucideIcon {
  return SUB_STATUS_OPTIONS.find((o) => o.value === status)?.icon ?? AlertCircle;
}

/** Etiqueta del estado de suscripción. Desconocido → el valor crudo. */
export function subStatusLabel(status: string): string {
  return SUB_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

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

const SUB_STATUS_CLASSES: Record<string, string> = {
  active: styles.subActive,
  past_due: styles.subPastDue,
  canceled: styles.subCanceled,
  expired: styles.subExpired,
  pending: styles.subPending,
};

export function SubStatusBadge({ status }: { status: string }) {
  // Etiqueta e icono salen de SUB_STATUS_OPTIONS para que el badge y el select
  // no muestren cosas distintas para el mismo estado.
  const Icon = subStatusIcon(status);
  return (
    <span className={`${styles.subBadge} ${SUB_STATUS_CLASSES[status] ?? ""}`}>
      <Icon size={11} />
      {subStatusLabel(status)}
    </span>
  );
}
