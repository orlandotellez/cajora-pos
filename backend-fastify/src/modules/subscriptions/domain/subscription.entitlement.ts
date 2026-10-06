import type { SubscriptionStatus } from "./subscription.types"

/** Días de tolerancia tras `current_period_end` antes de cortar el acceso. */
export const GRACE_DAYS = 3

const DAY_MS = 86_400_000

/** Campos de la suscripción que el reloj necesita para decidir el acceso. */
export interface EntitlementInput {
  status: SubscriptionStatus
  current_period_end: Date | null
}

export type EntitlementState = SubscriptionStatus

export interface Entitlement {
  /** Estado resuelto: el guardado cruzado con el reloj. Es lo que se cobra y lo que se muestra. */
  state: EntitlementState
  /** `false` corta el acceso con 402. `true` significa que hay período pagado (o gracia) vigente. */
  allowed: boolean
  /** Fin del período + `GRACE_DAYS`. `null` cuando no hay período registrado. */
  graceEndsAt: Date | null
  /** Días completos vencidos pasado el grace. `0` mientras se permite el acceso, `null` si no hay período. */
  daysOverdue: number | null
}

/**
 * Resuelve el derecho de acceso cruzando el `status` guardado con el reloj.
 *
 * El `status` de la fila dice lo último que reportó PayPal; eso solo cambia cuando
 * llega un webhook o una pasada de reconciliación, y ambos caminos pueden noarse
 * (webhook caído, `PAYPAL_ENABLED=false`, cobro rechazado sin evento). Por eso el
 * `current_period_end` es la fuente de verdad del acceso: sin él, una fila `active`
 * concede acceso indefinidamente aunque el período haya vencido hace meses.
 *
 * `pending` nunca concede acceso. Una fila sin `current_period_end` no tiene nada
 * pagado que la respalde y se resuelve como vencida.
 */
export function resolveEntitlement(sub: EntitlementInput, now: Date = new Date()): Entitlement {
  if (sub.status === "pending") {
    return { state: "pending", allowed: false, graceEndsAt: null, daysOverdue: null }
  }

  if (sub.status === "expired") {
    return { state: "expired", allowed: false, graceEndsAt: null, daysOverdue: null }
  }

  if (!sub.current_period_end) {
    return { state: "expired", allowed: false, graceEndsAt: null, daysOverdue: null }
  }

  const graceEndsAt = new Date(sub.current_period_end.getTime() + GRACE_DAYS * DAY_MS)

  if (now.getTime() <= graceEndsAt.getTime()) {
    return { state: sub.status, allowed: true, graceEndsAt, daysOverdue: 0 }
  }

  return {
    state: "expired",
    allowed: false,
    graceEndsAt,
    daysOverdue: Math.floor((now.getTime() - graceEndsAt.getTime()) / DAY_MS),
  }
}