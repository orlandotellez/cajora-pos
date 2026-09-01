import { NotFoundError, BadRequestError, ConflictError } from "@/core/errors/AppError"
import type { ICategoryRepository } from "../domain/categories.interface"
import type { ICategoryResponse, ICategoryListResponse } from "../domain/categories.types"
import type { CreateCategoryData, UpdateCategoryData } from "../domain/categories.entities"
import { Prisma } from "@prisma/client"

interface RichCategory {
  id: string
  name: string
  description?: string | null
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
  _count?: { products: number }
}

function mapCategoryToResponse(category: RichCategory): ICategoryResponse {
  return {
    id: category.id,
    name: category.name,
    description: category.description || undefined,
    product_count: category._count?.products ?? undefined,
    created_at: category.created_at instanceof Date ? category.created_at.toISOString() : category.created_at,
    updated_at: category.updated_at instanceof Date ? category.updated_at.toISOString() : category.updated_at,
  }
}

export const createCategoryService = (repository: ICategoryRepository) => ({
  list: async (params?: { search?: string; page?: number; limit?: number; storeId?: string }): Promise<ICategoryListResponse> => {
    const result = await repository.findAll(params)
    return {
      categories: result.categories.map(mapCategoryToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string, storeId?: string): Promise<ICategoryResponse> => {
    const category = await repository.findById(id, storeId)
    if (!category || category.deleted_at) {
      throw new NotFoundError("Category not found")
    }
    return mapCategoryToResponse(category)
  },

  create: async (data: CreateCategoryData, storeId?: string): Promise<ICategoryResponse> => {
    if (!data.name || data.name.trim() === "") {
      throw new BadRequestError("Name is required")
    }

    try {
      const category = await repository.create(data, storeId)
      return mapCategoryToResponse(category)
    } catch (err) {
      // El schema tiene @@unique([store_id, name]) → P2002 al duplicar
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("A category with this name already exists")
      }
      throw err
    }
  },

  update: async (id: string, data: UpdateCategoryData, storeId?: string): Promise<ICategoryResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Category not found")
    }

    try {
      const category = await repository.update(id, data, storeId)
      return mapCategoryToResponse(category)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("A category with this name already exists")
      }
      throw err
    }
  },

  delete: async (id: string, storeId?: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Category not found")
    }
    await repository.softDelete(id, storeId)
  },

  deleteMany: async (ids: string[], storeId?: string): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteMany(ids, storeId)
    return { deleted: result.count }
  },
})
