import { NotFoundError, ConflictError } from "@/core/errors/AppError"
import { hashPassword } from "@/core/utils/crypto.utils"
import type { IUserRepository } from "../domain/users.interface"
import type { IUserResponse, IUserListResponse } from "../domain/users.types"
import type { CreateUserData, UpdateUserData } from "../domain/users.entities"
import type { IUserEntity } from "../domain/users.entities"

function mapUserToResponse(user: IUserEntity): IUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role,
    permissions: user.permissions ?? [],
    phone: user.phone || undefined,
    image: user.image || undefined,
    created_at: user.created_at instanceof Date ? user.created_at : new Date(user.created_at),
    updated_at: user.updated_at instanceof Date ? user.updated_at : new Date(user.updated_at),
  }
}

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
})
