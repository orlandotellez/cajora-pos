import type { ICategoryResponse } from "../../domain/categories.types"

export interface RichCategory {
  id: string
  name: string
  description?: string | null
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
  _count?: { products: number }
}

export function mapCategoryToResponse(category: RichCategory): ICategoryResponse {
  return {
    id: category.id,
    name: category.name,
    description: category.description || undefined,
    product_count: category._count?.products ?? undefined,
    created_at: category.created_at instanceof Date ? category.created_at.toISOString() : category.created_at,
    updated_at: category.updated_at instanceof Date ? category.updated_at.toISOString() : category.updated_at,
  }
}