import type { Role } from "@/types/auth"
import type { Permission } from "./users.entities"

export interface IUserResponse {
  id: string
  name: string
  email: string
  email_verified: boolean
  role: Role
  permissions: Permission[]
  phone?: string
  image?: string
  created_at: Date
  updated_at: Date
}

export interface IUserListResponse {
  users: IUserResponse[]
  total: number
  page: number
  limit: number
}
