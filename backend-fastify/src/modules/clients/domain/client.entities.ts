export interface IClientEntity {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type CreateClientData = {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active?: boolean
}

export type UpdateClientData = Partial<CreateClientData>
