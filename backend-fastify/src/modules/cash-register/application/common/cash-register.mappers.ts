import type { ICashSessionEntity } from "../../domain/cash-register.entities"
import type { ICashSessionResponse } from "../../domain/cash-register.types"

export function mapSession(s: ICashSessionEntity): ICashSessionResponse {
  return {
    id: s.id,
    store_id: s.store_id,
    user_id: s.user_id,
    user_name: s.user_name,
    label: s.label ?? undefined,
    status: s.status as "abierto" | "cerrado",
    opening_amount: Number(s.opening_amount),
    closing_amount_counted: s.closing_amount_counted != null ? Number(s.closing_amount_counted) : undefined,
    expected_amount: s.expected_amount != null ? Number(s.expected_amount) : undefined,
    difference: s.difference != null ? Number(s.difference) : undefined,
    observations: s.observations ?? undefined,
    opened_at: s.opened_at instanceof Date ? s.opened_at.toISOString() : String(s.opened_at),
    closed_at: s.closed_at ? (s.closed_at instanceof Date ? s.closed_at.toISOString() : String(s.closed_at)) : undefined,
  }
}