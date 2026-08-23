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
