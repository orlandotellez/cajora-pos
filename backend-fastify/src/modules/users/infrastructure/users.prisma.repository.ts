import { prisma } from "@/config/prisma"
import type { IUserRepository } from "../domain/users.interface"
import type { IUserEntity, CreateUserData, UpdateUserData, Permission } from "../domain/users.entities"
import { Prisma } from "@prisma/client"

const userSelect = {
  id: true,
  name: true,
  email: true,
  email_verified: true,
  role: true,
  is_owner: true,
  is_active: true,
  permissions: true,
  phone: true,
  image: true,
  store_id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const

type UserRecord = Prisma.userGetPayload<{ select: typeof userSelect }>

function mapToEntity(user: UserRecord): IUserEntity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role,
    is_owner: user.is_owner ?? false,
    is_active: user.is_active ?? true,
    permissions: Array.isArray(user.permissions) ? (user.permissions as Permission[]) : [],
    phone: user.phone ?? null,
    image: user.image ?? null,
    store_id: user.store_id ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
    deleted_at: user.deleted_at ?? null,
  }
}

export const UserRepository: IUserRepository = {
  async findAll(params) {
    const where: Prisma.userWhereInput = { deleted_at: null }

    if (params?.storeId) {
      where.store_id = params.storeId
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ]
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where }),
    ])

    return { users: users.map(mapToEntity), total, page, limit }
  },

  async findById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: userSelect,
    })
    return user ? mapToEntity(user) : null
  },

  async findByEmail(email: string, storeId?: string) {
    const where: Prisma.userWhereInput = { email }
    if (storeId) {
      where.store_id = storeId
    }
    const user = await prisma.user.findFirst({ where, select: userSelect })
    return user ? mapToEntity(user) : null
  },

  async create(data: CreateUserData) {
    const { password, ...rest } = data
    const user = await prisma.user.create({
      data: {
        ...rest,
        email_verified: true,
      },
      select: userSelect,
    })

    // Store credentials in the account table so login works
    await prisma.account.create({
      data: {
        account_id: user.id,
        provider_id: "credentials",
        user_id: user.id,
        password,
      },
    })

    return mapToEntity(user)
  },

  async update(id: string, data: UpdateUserData) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
      select: userSelect,
    })
    return mapToEntity(user)
  },

  async softDelete(id: string) {
    await prisma.user.update({
      where: { id },
      data: { deleted_at: new Date() },
    })
  },

  async updatePassword(id: string, hashedPassword: string) {
    await prisma.account.updateMany({
      where: { user_id: id },
      data: { password: hashedPassword },
    })
  },
}
