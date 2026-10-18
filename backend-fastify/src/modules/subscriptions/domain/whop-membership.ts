/**
 * Contrato de una membership de Whop.
 *
 * Vive en el dominio, y no en `infrastructure/whop.client.ts`, porque el dominio
 * (la tabla de estados y las reglas de período) necesita razonar sobre esto: si el
 * tipo viviera en infraestructura, el dominio tendría que importar hacia afuera e
 * invertir la dependencia. El cliente HTTP lo importa de acá.
 *
 * Los estados se conservan tal cual los reporta Whop (literal union, snake_case) para
 * no inventar un mapeo en el borde: la traducción a `subscription.status` es una
 * decisión de dominio y vive en `whop-membership-sync.ts`.
 */

/** Estados que Whop reporta para una membership. */
export type WhopMembershipStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "completed"
  | "canceled"
  | "expired"
  | "unresolved"
  | "drafting"

export interface WhopMembershipUser {
  id: string
  email: string
  username: string
}

export interface WhopMembership {
  id: string
  status: WhopMembershipStatus
  user?: WhopMembershipUser | null
  renewal_period_start: string | null
  renewal_period_end: string | null
  cancel_at_period_end: boolean
  /** El checkout copia acá el `metadata` que mandó el embed (incluida la referencia firmada). */
  metadata?: Record<string, unknown> | null
  plan?: { id: string } | null
  product?: { id: string } | null
}
