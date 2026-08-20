import { prisma } from "@/config/prisma"
import type { IClientRepository } from "../domain/client.interface"
import type { IClientEntity, CreateClientData, UpdateClientData } from "../domain/client.entities"
import { Prisma } from "@prisma/client"

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const

type ClientRecord = Prisma.clientGetPayload<{ select: typeof clientSelect }>

function mapToEntity(client: ClientRecord): IClientEntity {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone || undefined,
    email: client.email || undefined,
    address: client.address || undefined,
    notes: client.notes || undefined,
    is_active: client.is_active,
    created_at: client.created_at,
    updated_at: client.updated_at,
    deleted_at: client.deleted_at || undefined,
  }
}

export const ClientRepository: IClientRepository = {
  async findAll(params) {
    const where: Prisma.clientWhereInput = {
      deleted_at: null,
      ...(params?.storeId && { store_id: params.storeId }),
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ]
    }

    if (params?.is_active !== undefined) {
      where.is_active = params.is_active
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: clientSelect,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.client.count({ where }),
    ])

    return {
      clients: clients.map(mapToEntity),
      total,
      page,
      limit,
    }
  },

  async findById(id: string, storeId?: string) {
    const result = await prisma.client.findFirst({
      where: { id, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: clientSelect,
    })
    if (!result) return null
    return mapToEntity(result)
  },

  async findByPhone(phone: string, storeId?: string) {
    const result = await prisma.client.findFirst({
      where: { phone, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: clientSelect,
    })
    if (!result) return null
    return mapToEntity(result)
  },

  async create(data: CreateClientData, storeId?: string) {
    const client = await prisma.client.create({
      data: {
        ...(storeId && { store_id: storeId }),
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        notes: data.notes,
        is_active: data.is_active ?? true,
      },
      select: clientSelect,
    })
    return mapToEntity(client)
  },

  async update(id: string, data: UpdateClientData, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.clientWhereUniqueInput & { store_id?: string }
    const client = await prisma.client.update({
      where,
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
      select: clientSelect,
    })
    return mapToEntity(client)
  },

  async softDelete(id: string, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.clientWhereUniqueInput & { store_id?: string }
    await prisma.client.update({
      where,
      data: { deleted_at: new Date() },
    })
  },

  async getSaleCount(clientId: string) {
    return prisma.sale.count({ where: { client_id: clientId } })
  },

  async getTotalSpent(clientId: string) {
    const result = await prisma.sale.aggregate({
      where: { client_id: clientId },
      _sum: { total: true },
    })
    return Number(result._sum.total ?? 0)
  },

  async getRecentSales(clientId: string, limit = 5) {
    const sales = await prisma.sale.findMany({
      where: { client_id: clientId },
      select: {
        id: true,
        total: true,
        payment_method: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
      take: limit,
    })
    return sales.map((s) => ({
      id: s.id,
      total: Number(s.total),
      payment_method: s.payment_method,
      created_at: s.created_at,
    }))
  },
}
