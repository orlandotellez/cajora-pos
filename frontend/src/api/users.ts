import { api } from "./client";
import type { Role, Permission } from "@/api/auth";

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  role: Role;
  is_owner: boolean;
  is_active: boolean;
  permissions: Permission[];
  phone?: string;
  image?: string;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  permissions?: Permission[];
  phone?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: Role;
  permissions?: Permission[];
  phone?: string;
}

export const usersApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<UserListResponse>("/users", params),

  getById: (id: string) =>
    api.get<UserResponse>(`/users/${id}`),

  create: (data: CreateUserPayload) =>
    api.post<UserResponse>("/users", data),

  update: (id: string, data: UpdateUserPayload) =>
    api.put<UserResponse>(`/users/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/users/${id}`),

  toggleActive: (id: string, is_active: boolean) =>
    api.patch<UserResponse>(`/users/${id}/active`, { is_active }),
};
