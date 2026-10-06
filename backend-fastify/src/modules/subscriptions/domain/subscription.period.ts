/**
 * Aritmética del período de facturación mensual.
 *
 * Vive en el dominio y en un solo lugar porque había dos copias de `PERIOD_DAYS`
 * (service de suscripciones y controller de webhooks) y el panel de super admin
 * necesitaba una tercera: el acceso se decide contra `current_period_end`, así que
 * activar una suscripción sin período la deja igual de bloqueada.
 */

/** Duración de un período facturado. */
export const PERIOD_DAYS = 30

export const DAY_MS = 86_400_000

/** Fin del período que arranca en `from`. */
export function periodEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + PERIOD_DAYS * DAY_MS)
}

/**
 * ¿Hace falta otorgar un período nuevo al activar?
 *
 * `true` cuando no hay período o ya venció. Si el período guardado sigue vigente
 * se respeta: activar no debe recortar meses ya pagados.
 */
export function needsFreshPeriod(
  current: { current_period_end: Date | null },
  now: Date = new Date(),
): boolean {
  return !current.current_period_end || current.current_period_end.getTime() <= now.getTime()
}
