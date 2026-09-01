import type { CreateUserData, UpdateUserData, IUserEntity } from "./users.entities"

export interface IUserRepository {
  findAll(params?: { page?: number; limit?: number; search?: string; storeId?: string }): Promise<{ users: IUserEntity[]; total: number; page: number; limit: number }>
  findById(id: string): Promise<IUserEntity | null>
  findByEmail(email: string, storeId?: string): Promise<IUserEntity | null>
  create(data: CreateUserData): Promise<IUserEntity>
  update(id: string, data: UpdateUserData): Promise<IUserEntity>
  softDelete(id: string): Promise<void>
  softDeleteMany(ids: string[]): Promise<{ count: number }>
  updatePassword(id: string, hashedPassword: string): Promise<void>
}
