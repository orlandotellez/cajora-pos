import { api } from "./client";





export interface ServiceProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  is_active: boolean;
  products: ServiceProduct[];
  created_at: string;
  updated_at: string;
}

export interface ServiceListResponse {
  services: Service[];
  total: number;
  page: number;
  limit: number;
}

export interface DeleteResponse {
  message: string;
}





export interface ServiceProductPayload {
  product_id: string;
  quantity: number;
}

export interface CreateServicePayload {
  name: string;
  description?: string;
  base_price: number;
  is_active?: boolean;
  products?: ServiceProductPayload[];
}

export interface UpdateServicePayload extends Partial<CreateServicePayload> {}





export const servicesApi = {
  list: (params?: {
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<ServiceListResponse>("/services", params as Record<string, string | number | boolean | undefined>),

  getById: (id: string) =>
    api.get<Service>(`/services/${id}`),

  create: (data: CreateServicePayload) =>
    api.post<Service>("/services", data),

  update: (id: string, data: UpdateServicePayload) =>
    api.put<Service>(`/services/${id}`, data),

  delete: (id: string) =>
    api.delete<DeleteResponse>(`/services/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post<{ deleted: number }>("/services/bulk-delete", { ids }),
};
