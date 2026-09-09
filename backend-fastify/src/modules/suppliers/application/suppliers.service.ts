import { NotFoundError, BadRequestError } from "@/core/errors/AppError"
import type { ISupplierRepository } from "../domain/suppliers.interface"
import type { ISupplierResponse, ISupplierListResponse } from "../domain/suppliers.types"
import type { CreateSupplierData, UpdateSupplierData } from "../domain/suppliers.entities"
import { mapSupplierToResponse } from "./common/suppliers.mappers"

export const createSupplierService = (repository: ISupplierRepository) => ({
  list: async (params?: { search?: string; is_active?: boolean; page?: number; limit?: number; storeId?: string }): Promise<ISupplierListResponse> => {
    const result = await repository.findAll(params)
    return {
      suppliers: result.suppliers.map(mapSupplierToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string, storeId?: string): Promise<ISupplierResponse> => {
    const supplier = await repository.findById(id, storeId)
    if (!supplier || supplier.deleted_at) {
      throw new NotFoundError("Supplier not found")
    }
    return mapSupplierToResponse(supplier)
  },

  create: async (data: CreateSupplierData, storeId?: string): Promise<ISupplierResponse> => {
    if (!data.name || data.name.trim() === "") {
      throw new BadRequestError("Name is required")
    }

    const supplier = await repository.create(data, storeId)
    return mapSupplierToResponse(supplier)
  },

  update: async (id: string, data: UpdateSupplierData, storeId?: string): Promise<ISupplierResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Supplier not found")
    }

    const supplier = await repository.update(id, data, storeId)
    return mapSupplierToResponse(supplier)
  },

  delete: async (id: string, storeId?: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Supplier not found")
    }
    await repository.softDelete(id, storeId)
  },

  deleteMany: async (ids: string[], storeId?: string): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteMany(ids, storeId)
    return { deleted: result.count }
  },
})
