import type { ROLE } from "@prisma/client"

export type Permission =
  | "catalog_read"
  | "catalog_write"
  | "inventory_read"
  | "inventory_write"
  | "reports"
  | "settings"
  | "users"

export interface IUserEntity {
  id: string
  name: string
  email: string
  email_verified: boolean
  role: ROLE
  is_owner: boolean
  is_active: boolean
  permissions: Permission[]
  phone?: string | null
  image?: string | null
  store_id?: string | null
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
}

export interface CreateUserData {
  name: string
  email: string
  password: string
  role?: ROLE
  permissions?: Permission[]
  phone?: string
  store_id?: string
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: ROLE
  permissions?: Permission[]
  phone?: string
  is_active?: boolean
}
