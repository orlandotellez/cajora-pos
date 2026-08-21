import type { Role } from "@/types/auth"

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
  phone?: string
  image?: string
  role: Role
  permissions: Permission[]
  store_id: string | null
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export interface IAccountEntity {
  id: string
  account_id: string
  provider_id: string
  user_id?: string
  access_token?: string
  refresh_token?: string
  id_token?: string
  access_token_expires_at?: Date
  refresh_token_expires_at?: Date
  scope?: string
  password?: string
  created_at: Date
  updated_at: Date
}

export interface ISessionEntity {
  id: string
  expires_at: Date
  token: string
  ip_address?: string
  user_agent?: string
  user_id: string
  created_at: Date
  updated_at: Date
}

export interface IVerificationEntity {
  id: string
  identifier: string
  value: string
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export type CreateUserData = Pick<IUserEntity, "name" | "email" | "role" | "store_id"> & {
  phone?: string
  image?: string
  email_verified?: boolean
}

export type UpdateUserData = Partial<Pick<IUserEntity, "name" | "phone" | "image" | "role" | "email_verified">>

export type CreateAccountData = Pick<IAccountEntity, "account_id" | "provider_id"> & {
  user_id?: string
  access_token?: string
  refresh_token?: string
  id_token?: string
  access_token_expires_at?: Date
  refresh_token_expires_at?: Date
  scope?: string
  password?: string
}

export type CreateSessionData = {
  userId: string
  token: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
}

export type CreateVerificationData = {
  identifier: string
  value: string
  expiresAt: Date
}
