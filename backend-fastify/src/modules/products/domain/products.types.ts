export interface IProductCategory {
  id: string
  name: string
}

export interface IProductResponse {
  id: string
  barcode?: string
  name: string
  unit_type?: string
  unit_quantity?: number
  category?: IProductCategory
  supplier?: { id: string; name: string } | null
  price: number
  cost: number
  stock: number
  low_stock_threshold: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface IProductListResponse {
  products: IProductResponse[]
  total: number
  page: number
  limit: number
}

export interface IProductQueryParams {
  search?: string
  category_id?: string
  active?: boolean
  low_stock?: boolean
  out_of_stock?: boolean
  page?: number
  limit?: number
}
