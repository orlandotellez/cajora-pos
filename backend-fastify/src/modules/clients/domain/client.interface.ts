import type { IClientEntity, CreateClientData, UpdateClientData } from "./client.entities"

export interface IClientRepository {
  findAll(params?: { search?: string; is_active?: boolean; page?: number; limit?: number; storeId?: string }): Promise<{ clients: IClientEntity[]; total: number; page: number; limit: number }>
  findById(id: string, storeId?: string): Promise<IClientEntity | null>
  findByPhone(phone: string, storeId?: string): Promise<IClientEntity | null>
  create(data: CreateClientData, storeId?: string): Promise<IClientEntity>
  update(id: string, data: UpdateClientData, storeId?: string): Promise<IClientEntity>
  softDelete(id: string, storeId?: string): Promise<void>
  getSaleCount(clientId: string): Promise<number>
  getTotalSpent(clientId: string): Promise<number>
  getRecentSales(clientId: string, limit?: number): Promise<{ id: string; total: number; payment_method: string; created_at: Date }[]>
}
