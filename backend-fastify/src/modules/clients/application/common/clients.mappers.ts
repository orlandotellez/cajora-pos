import type { IClientResponse } from "../../domain/client.types"

export interface RichClient {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
}

export function mapClientToResponse(client: RichClient, extra?: { sale_count?: number; total_spent?: number }): IClientResponse {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone || undefined,
    email: client.email || undefined,
    address: client.address || undefined,
    notes: client.notes || undefined,
    is_active: client.is_active,
    sale_count: extra?.sale_count,
    total_spent: extra?.total_spent,
    created_at: client.created_at instanceof Date ? client.created_at.toISOString() : client.created_at,
    updated_at: client.updated_at instanceof Date ? client.updated_at.toISOString() : client.updated_at,
  }
}