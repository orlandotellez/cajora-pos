import { api } from "./client";





export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductSupplier {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  barcode?: string;
  name: string;
  unit_type?: string;
  unit_quantity?: number;
  category?: ProductCategory;
  supplier?: ProductSupplier | null;
  price: number;
  cost: number;
  stock: number;
  low_stock_threshold: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface DeleteResponse {
  message: string;
}





export interface CreateProductPayload {
  barcode?: string;
  name: string;
  unit_type?: string;
  unit_quantity?: number;
  category_id?: string | null;
  supplier_id?: string | null;
  price: number;
  cost?: number;
  stock?: number;
  low_stock_threshold?: number;
  active?: boolean;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> { }





export const productsApi = {
  list: (params?: {
    search?: string;
    category_id?: string;
    active?: boolean;
    low_stock?: boolean;
    out_of_stock?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<ProductListResponse>("/products", params as Record<string, string | number | boolean | undefined>),

  getById: (id: string) =>
    api.get<Product>(`/products/${id}`),

  getByBarcode: (barcode: string) =>
    api.get<Product>(`/products/barcode/${barcode}`),

  create: (data: CreateProductPayload) =>
    api.post<Product>("/products", data),

  update: (id: string, data: UpdateProductPayload) =>
    api.put<Product>(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete<DeleteResponse>(`/products/${id}`),
};
