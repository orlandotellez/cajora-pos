import type { account, session, user, verification } from "@prisma/client"

export type Role = "admin" | "cajero" | "super_admin"

export interface User extends user {
  id: string
  name: string
  email: string
  email_verified: boolean
  phone?: string
  image?: string
  role: Role
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export interface Account extends account {
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

export interface Session extends session {
  id: string
  expires_at: Date
  token: string
  ip_address?: string
  user_agent?: string
  user_id: string
  created_at: Date
  updated_at: Date
}

export interface Verification extends verification {
  id: string
  identifier: string
  value: string
  expires_at: Date
  created_at: Date
  updated_at: Date
}
