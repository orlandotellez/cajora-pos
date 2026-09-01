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
  barcode?: string | null;
  name: string;
  unit_type?: string | null;
  unit_quantity?: number | null;
  category_id?: string | null;
  supplier_id?: string | null;
  price: number;
  cost?: number;
  stock?: number;
  low_stock_threshold?: number;
  active?: boolean;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> { }

export interface ImportProductRow {
  barcode?: string | null;
  name: string;
  unit_type?: string | null;
  unit_quantity?: number | null;
  price: number;
  cost?: number;
  stock?: number;
  low_stock_threshold?: number;
  active?: boolean;
  category_name?: string;
  supplier_name?: string;
}

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

export const productsApi = {
  list: (params?: {
    search?: string;
    category_id?: string;
    unit_type?: string;
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

  bulkDelete: (ids: string[]) =>
    api.post<{ deleted: number }>("/products/bulk-delete", { ids }),

  bulkDeleteAll: async (filters?: { search?: string; category_id?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.search) qs.set("search", filters.search);
    if (filters?.category_id) qs.set("category_id", filters.category_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.delete<{ deleted: number }>(`/products/all${suffix}`);
  },

  importCsv: (rows: ImportProductRow[]) =>
    api.post<ImportResult>("/products/import", { rows }),
};
