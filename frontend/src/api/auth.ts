import { api } from "./client";

export type Role = "admin" | "cajero" | "super_admin";

export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  role: Role;
  phone?: string;
  image?: string;
  store_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  // null para super admin (no pertenece a ninguna tienda)
  store: Store | null;
  accessToken: string;
  refreshToken: string;
}

export interface MessageResponse {
  message: string;
}

export interface RefreshResponse {
  message: string;
  user: AuthUser;
  // null para super admin (no pertenece a ninguna tienda)
  store: Store | null;
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordResponse {
  message: string;
  expires_at: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyEmailPayload {
  identifier: string;
  code: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

export interface RegisterStorePayload {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthResponse>("/auth/register", data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", data),

  logout: (refreshToken?: string) =>
    api.post<MessageResponse>("/auth/logout", refreshToken ? { refreshToken } : undefined),

  refresh: (refreshToken?: string) =>
    api.post<RefreshResponse>("/auth/refresh", refreshToken ? { refreshToken } : undefined),

  verifyEmail: (data: VerifyEmailPayload) =>
    api.post<MessageResponse>("/auth/verify-email", data),

  resendVerification: (data: ResendVerificationPayload) =>
    api.post<MessageResponse>("/auth/resend-verification", data),

  forgotPassword: (data: ForgotPasswordPayload) =>
    api.post<ForgotPasswordResponse>("/auth/forgot-password", data),

  resetPassword: (data: ResetPasswordPayload) =>
    api.post<MessageResponse>("/auth/reset-password", data),

  registerStore: (data: RegisterStorePayload) =>
    api.post<AuthResponse>("/auth/register-store", data),
};
