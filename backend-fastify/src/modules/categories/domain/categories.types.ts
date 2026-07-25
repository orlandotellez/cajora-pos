export interface ICategoryResponse {
  id: string
  name: string
  description?: string
  product_count?: number
  created_at: string
  updated_at: string
}

export interface ICategoryListResponse {
  categories: ICategoryResponse[]
  total: number
  page: number
  limit: number
}
