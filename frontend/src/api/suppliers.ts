import { api } from "./client";

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierListResponse {
  suppliers: Supplier[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSupplierPayload {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
}

export interface UpdateSupplierPayload extends Partial<CreateSupplierPayload> {}

export const suppliersApi = {
  list: (params?: {
    search?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<SupplierListResponse>("/suppliers", params as Record<string, string | number | boolean | undefined>),

  getById: (id: string) =>
    api.get<Supplier>(`/suppliers/${id}`),

  create: (data: CreateSupplierPayload) =>
    api.post<Supplier>("/suppliers", data),

  update: (id: string, data: UpdateSupplierPayload) =>
    api.put<Supplier>(`/suppliers/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/suppliers/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post<{ deleted: number }>("/suppliers/bulk-delete", { ids }),
};
