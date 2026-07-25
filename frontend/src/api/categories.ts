import { api } from "./client";

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  page: number;
  limit: number;
}

export type CreateCategoryPayload = {
  name: string;
  description?: string;
};

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export const categoriesApi = {
  /** GET /categories — array simple para dropdowns (compatibilidad). */
  list: () => api.get<Category[]>("/categories"),

  /** GET /categories/paginated — listado paginado para la página admin. */
  listPaginated: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<CategoryListResponse>("/categories/paginated", params as Record<string, string | number | boolean | undefined>),

  create: (data: CreateCategoryPayload) =>
    api.post<Category>("/categories", data),

  update: (id: string, data: UpdateCategoryPayload) =>
    api.put<Category>(`/categories/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/categories/${id}`),
};
