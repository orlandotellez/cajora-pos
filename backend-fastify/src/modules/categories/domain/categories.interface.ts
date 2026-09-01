import type { ICategoryEntity, CreateCategoryData, UpdateCategoryData } from "./categories.entities"

export interface ICategoryRepository {
  findAll(params?: { search?: string; page?: number; limit?: number; storeId?: string }): Promise<{ categories: ICategoryEntity[]; total: number; page: number; limit: number }>
  findById(id: string, storeId?: string): Promise<ICategoryEntity | null>
  create(data: CreateCategoryData, storeId?: string): Promise<ICategoryEntity>
  update(id: string, data: UpdateCategoryData, storeId?: string): Promise<ICategoryEntity>
  softDelete(id: string, storeId?: string): Promise<void>
  softDeleteMany(ids: string[], storeId?: string): Promise<{ count: number }>
}
