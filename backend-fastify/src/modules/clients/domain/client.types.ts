export interface IClientResponse {
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

export interface IClientListResponse {
  clients: IClientResponse[]
  total: number
  page: number
  limit: number
}

export interface IClientSaleSummary {
  id: string
  total: number
  payment_method: string
  created_at: string
}

export interface IClientDetailResponse extends IClientResponse {
  recent_sales: IClientSaleSummary[]
}
