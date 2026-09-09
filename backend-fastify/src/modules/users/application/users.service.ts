import { NotFoundError, ConflictError } from "@/core/errors/AppError"
import { hashPassword } from "@/modules/auth/application/common/crypto.utils"
import type { IUserRepository } from "../domain/users.interface"
import type { IUserResponse, IUserListResponse } from "../domain/users.types"
import type { CreateUserData, UpdateUserData } from "../domain/users.entities"
import { mapUserToResponse } from "./common/users.mappers"

export const createUserService = (repository: IUserRepository) => ({
  list: async (params?: { search?: string; page?: number; limit?: number; storeId?: string }): Promise<IUserListResponse> => {
    const result = await repository.findAll(params)
    return {
      users: result.users.map(mapUserToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string): Promise<IUserResponse> => {
    const user = await repository.findById(id)
    if (!user) throw new NotFoundError("User not found")
    return mapUserToResponse(user)
  },

  create: async (data: CreateUserData, storeId?: string): Promise<IUserResponse> => {
    const existing = await repository.findByEmail(data.email, storeId)
    if (existing) throw new ConflictError("A user with this email already exists")

    const hashed = await hashPassword(data.password)

    const user = await repository.create({
      ...data,
      password: hashed,
    })

    return mapUserToResponse(user)
  },

  update: async (id: string, data: UpdateUserData, storeId?: string): Promise<IUserResponse> => {
    const existing = await repository.findById(id)
    if (!existing) throw new NotFoundError("User not found")

    if (data.email && data.email !== existing.email) {
      const duplicate = await repository.findByEmail(data.email, storeId)
      if (duplicate) throw new ConflictError("A user with this email already exists")
    }

    const user = await repository.update(id, data)
    return mapUserToResponse(user)
  },

  delete: async (id: string): Promise<void> => {
    const existing = await repository.findById(id)
    if (!existing) throw new NotFoundError("User not found")
    await repository.softDelete(id)
  },

  deleteMany: async (ids: string[]): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteMany(ids)
    return { deleted: result.count }
  },

  toggleActive: async (id: string, isActive: boolean): Promise<IUserResponse> => {
    const existing = await repository.findById(id)
    if (!existing) throw new NotFoundError("User not found")
    const user = await repository.update(id, { is_active: isActive } as UpdateUserData)
    return mapUserToResponse(user)
  },
})
