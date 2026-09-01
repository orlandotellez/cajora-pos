import type { IServiceEntity, CreateServiceData, UpdateServiceData } from "./services.entities"

export interface IServiceRepository {
  findAll(params?: { search?: string; active?: boolean; page?: number; limit?: number; storeId?: string }): Promise<{ services: IServiceEntity[]; total: number; page: number; limit: number }>
  findById(id: string, storeId?: string): Promise<IServiceEntity | null>
  create(data: CreateServiceData, storeId?: string): Promise<IServiceEntity>
  update(id: string, data: UpdateServiceData, storeId?: string): Promise<IServiceEntity>
  softDelete(id: string, storeId?: string): Promise<void>
  softDeleteMany(ids: string[], storeId?: string): Promise<{ count: number }>
}
