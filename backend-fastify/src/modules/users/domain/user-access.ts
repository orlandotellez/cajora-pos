import type { USER_ACCESS } from "@prisma/client"

/**
 * Estado de acceso de un usuario a la plataforma.
 *
 * - `ok` — puede operar.
 * - `inactive` — lo desactivó el dueño/admin de la tienda (switch `is_active`).
 * - `restricted` — lo restringió el super admin (`access_status`); el dueño de la
 *   tienda no puede revertirlo.
 */
export type UserAccessState = "ok" | "inactive" | "restricted"

export interface UserAccessInput {
  is_active: boolean
  access_status: USER_ACCESS
}

/**
 * Única fuente de verdad de "¿este usuario puede entrar?".
 *
 * Vive acá y no duplicada en cada punto de control porque el repo ya se comió un
 * bypass por tener criterios distintos en guards distintos: si el guard, el login
 * y el refresh evalúan por separado, alcanza con que uno se desactualice para
 * reabrir el agujero.
 *
 * La restricción de plataforma gana sobre `is_active`: es la más específica y la
 * única que el usuario no puede resolver por su cuenta.
 */
export function evaluateUserAccess(user: UserAccessInput): UserAccessState {
  if (user.access_status === "restricted") return "restricted"
  if (!user.is_active) return "inactive"
  return "ok"
}