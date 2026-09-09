import { NotFoundError, ConflictError } from "@/core/errors/AppError"
import type { IServiceRepository } from "../domain/services.interface"
import type { IServiceResponse, IServiceListResponse, IServiceProductResponse } from "../domain/services.types"
import type { CreateServiceData, UpdateServiceData } from "../domain/services.entities"
import { mapServiceToResponse } from "./common/services.mappers"

export const createServiceService = (repository: IServiceRepository) => ({
  list: async (params?: { search?: string; active?: boolean; page?: number; limit?: number }, storeId?: string): Promise<IServiceListResponse> => {
    const result = await repository.findAll({ ...params, storeId })
    return {
      services: result.services.map(mapServiceToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string, storeId?: string): Promise<IServiceResponse> => {
    const service = await repository.findById(id, storeId)
    if (!service || service.deleted_at) {
      throw new NotFoundError("Service not found")
    }
    return mapServiceToResponse(service)
  },

  create: async (data: CreateServiceData, storeId?: string): Promise<IServiceResponse> => {
    const service = await repository.create(data, storeId)
    return mapServiceToResponse(service)
  },

  update: async (id: string, data: UpdateServiceData, storeId?: string): Promise<IServiceResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Service not found")
    }

    const service = await repository.update(id, data, storeId)
    return mapServiceToResponse(service)
  },

  delete: async (id: string, storeId?: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Service not found")
    }
    await repository.softDelete(id, storeId)
  },

  deleteMany: async (ids: string[], storeId?: string): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteMany(ids, storeId)
    return { deleted: result.count }
  },
})
