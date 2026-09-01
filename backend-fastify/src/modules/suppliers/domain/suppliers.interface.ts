import type { ISupplierEntity, CreateSupplierData, UpdateSupplierData } from "./suppliers.entities"

export interface ISupplierRepository {
  findAll(params?: { search?: string; is_active?: boolean; page?: number; limit?: number; storeId?: string }): Promise<{ suppliers: ISupplierEntity[]; total: number; page: number; limit: number }>
  findById(id: string, storeId?: string): Promise<ISupplierEntity | null>
  create(data: CreateSupplierData, storeId?: string): Promise<ISupplierEntity>
  update(id: string, data: UpdateSupplierData, storeId?: string): Promise<ISupplierEntity>
  softDelete(id: string, storeId?: string): Promise<void>
  softDeleteMany(ids: string[], storeId?: string): Promise<{ count: number }>
}
