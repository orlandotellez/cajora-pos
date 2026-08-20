import { api } from "./client"

export interface Client {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  sale_count?: number
  total_spent?: number
  created_at: string
  updated_at: string
}

export interface ClientListResponse {
  clients: Client[]
  total: number
  page: number
  limit: number
}

export interface ClientSaleSummary {
  id: string
  total: number
  payment_method: string
  created_at: string
}

export interface ClientDetailResponse extends Client {
  recent_sales: ClientSaleSummary[]
}

export interface DeleteResponse {
  message: string
}

export interface CreateClientPayload {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active?: boolean
}

export interface UpdateClientPayload extends Partial<CreateClientPayload> {}

export const clientsApi = {
  list: (params?: {
    search?: string
    is_active?: boolean
    page?: number
    limit?: number
  }) =>
    api.get<ClientListResponse>(
      "/clients",
      params as Record<string, string | number | boolean | undefined>,
    ),

  getById: (id: string) => api.get<ClientDetailResponse>(`/clients/${id}`),

  findByPhone: (phone: string) =>
    api.get<Client | null>(
      "/clients/by-phone",
      { phone } as Record<string, string>,
    ),

  create: (data: CreateClientPayload) =>
    api.post<Client>("/clients", data),

  update: (id: string, data: UpdateClientPayload) =>
    api.put<Client>(`/clients/${id}`, data),

  delete: (id: string) =>
    api.delete<DeleteResponse>(`/clients/${id}`),
}
