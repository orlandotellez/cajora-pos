/** Iniciales (máx. 2 letras) derivadas del nombre. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Color determinístico por nombre para avatares. */
export function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

export function formatEventAction(action: string): string {
  const map: Record<string, string> = {
    webhook_payment_failed: "Pago fallido",
    webhook_suspended: "Suspendida",
    webhook_cancelled: "Cancelada",
    webhook_expired: "Expirada",
    webhook_activated: "Activada",
    webhook_sale_completed: "Pago completado",
    checkout: "Checkout",
    activate: "Activación",
    cancel: "Cancelación",
    reactivate: "Reactivación",
  };
  return map[action] ?? action;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type RemainingTone = "expired" | "urgent" | "ok";

export interface RemainingTime {
  /** Texto listo para mostrar: "20d 4h", "<1h" o "Expirado". */
  text: string;
  tone: RemainingTone;
}

/**
 * Tiempo que falta hasta `periodEnd`, con precisión de días y horas ("20d 4h").
 *
 * El backend manda `days_until_expiry`, pero lo redondea hacia arriba con
 * `Math.ceil` a días enteros: se pierden las horas, así que "30d" puede ser en
 * realidad 29d 2h. Acá se calcula desde `current_period_end` para tener la
 * precisión que el panel necesita.
 *
 * - `ms <= 0` → "Expirado" (tono `expired`).
 * - Menos de una hora restante → "<1h" (nunca "0d 0h").
 * - Menos de 3 días → tono `urgent`; el resto, `ok`.
 *
 * Devuelve `null` si no hay fecha de fin (o es inválida).
 */
export function timeUntil(periodEnd: string | null, now: number = Date.now()): RemainingTime | null {
  if (!periodEnd) return null;
  const end = new Date(periodEnd).getTime();
  if (Number.isNaN(end)) return null;

  const ms = end - now;
  if (ms <= 0) return { text: "Expirado", tone: "expired" };

  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);

  return {
    text: days === 0 && hours === 0 ? "<1h" : `${days}d ${hours}h`,
    tone: ms <= 3 * DAY_MS ? "urgent" : "ok",
  };
}
