import type { IInventoryMovementEntity, CreateMovementData } from "./inventory.entities"

export interface IInventoryRepository {
  create(data: CreateMovementData): Promise<IInventoryMovementEntity>
  findByProductId(productId: string, params?: { limit?: number; storeId?: string }): Promise<IInventoryMovementEntity[]>
  findAll(params?: { product_id?: string; movement_type?: string; page?: number; limit?: number; storeId?: string }): Promise<{ movements: IInventoryMovementEntity[]; total: number; page: number; limit: number }>
}

export interface ICashIntegrationPort {
  resolveExpenseSession(params: { storeId: string; userId: string }): Promise<{ session_id: string }>

  registerExpense(data: {
    session_id: string
    user_id: string
    amount: number
    reason: string
    source_type?: string
    ref_id?: string
    description?: string
  }): Promise<void>
}
