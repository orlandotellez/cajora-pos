import type { Role } from "@/types/auth"

export interface IRegisterPayload {
  name: string
  email: string
  password: string
  role?: Role
}

export interface ILoginPayload {
  email: string
  password: string
}

export interface IVerifyEmailPayload {
  identifier: string
  code: string
}

export interface IForgotPasswordPayload {
  email: string
}

export interface IResetPasswordPayload {
  email: string
  code: string
  newPassword: string
}

export interface IStoreResponse {
  id: string
  name: string
  address?: string
  phone?: string
}

export interface IUserResponse {
  id: string
  name: string
  email: string
  email_verified: boolean
  role: Role
  phone?: string
  image?: string
  store_id: string | null
  created_at: Date
  updated_at: Date
}

export interface IAuthResponse {
  message: string
  user: IUserResponse
  // null para super admin (no pertenece a ninguna tienda)
  store: IStoreResponse | null
  accessToken: string
  refreshToken: string
}

export interface IRefreshResponse {
  message: string
  user: IUserResponse
  // null para super admin (no pertenece a ninguna tienda)
  store: IStoreResponse | null
  accessToken: string
  refreshToken: string
}

export interface IVerificationResponse {
  message: string
  expiresAt: Date
}

export interface ILogoutResponse {
  message: string
}

export interface ISessionResponse {
  id: string
  expires_at: Date
  ip_address?: string
  user_agent?: string
  created_at: Date
  updated_at: Date
}

export interface IUserSessionsResponse {
  sessions: ISessionResponse[]
}

export interface IVerifyEmailResponse {
  message: string
  accessToken: string
  refreshToken: string
}

export interface IForgotPasswordResponse {
  message: string
  expires_at: Date
}

export interface IResetPasswordResponse {
  message: string
}

// ─── Register Store ───
export interface IRegisterStorePayload {
  storeName: string
  storeAddress?: string
  storePhone?: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

export interface IRegisterStoreResponse {
  message: string
  user: IUserResponse
  store: IStoreResponse
  accessToken: string
  refreshToken: string
}
