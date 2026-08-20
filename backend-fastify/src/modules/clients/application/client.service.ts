import { NotFoundError, BadRequestError } from "@/core/errors/AppError"
import type { IClientRepository } from "../domain/client.interface"
import type { IClientResponse, IClientListResponse, IClientDetailResponse } from "../domain/client.types"
import type { CreateClientData, UpdateClientData } from "../domain/client.entities"

interface RichClient {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
}

function mapClientToResponse(client: RichClient, extra?: { sale_count?: number; total_spent?: number }): IClientResponse {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone || undefined,
    email: client.email || undefined,
    address: client.address || undefined,
    notes: client.notes || undefined,
    is_active: client.is_active,
    sale_count: extra?.sale_count,
    total_spent: extra?.total_spent,
    created_at: client.created_at instanceof Date ? client.created_at.toISOString() : client.created_at,
    updated_at: client.updated_at instanceof Date ? client.updated_at.toISOString() : client.updated_at,
  }
}

export const createClientService = (repository: IClientRepository) => ({
  list: async (params?: { search?: string; is_active?: boolean; page?: number; limit?: number; storeId?: string }): Promise<IClientListResponse> => {
    const result = await repository.findAll(params)
    return {
      clients: result.clients.map(mapClientToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string, storeId?: string): Promise<IClientDetailResponse> => {
    const client = await repository.findById(id, storeId)
    if (!client || client.deleted_at) {
      throw new NotFoundError("Client not found")
    }

    const [sale_count, total_spent, recent_sales] = await Promise.all([
      repository.getSaleCount(id),
      repository.getTotalSpent(id),
      repository.getRecentSales(id, 10),
    ])

    return {
      ...mapClientToResponse(client, { sale_count, total_spent }),
      recent_sales: recent_sales.map((s) => ({
        id: s.id,
        total: s.total,
        payment_method: s.payment_method,
        created_at: s.created_at instanceof Date ? s.created_at.toISOString() : s.created_at,
        items: s.items,
        service_items: s.service_items,
      })),
    }
  },

  findByPhone: async (phone: string, storeId?: string): Promise<IClientResponse | null> => {
    const client = await repository.findByPhone(phone, storeId)
    if (!client || client.deleted_at) return null
    return mapClientToResponse(client)
  },

  create: async (data: CreateClientData, storeId?: string): Promise<IClientResponse> => {
    if (!data.name || data.name.trim() === "") {
      throw new BadRequestError("Name is required")
    }

    // Check for duplicate phone within the store
    if (data.phone && storeId) {
      const existing = await repository.findByPhone(data.phone, storeId)
      if (existing) {
        throw new BadRequestError("A client with this phone number already exists")
      }
    }

    const client = await repository.create(data, storeId)
    return mapClientToResponse(client)
  },

  update: async (id: string, data: UpdateClientData, storeId?: string): Promise<IClientResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Client not found")
    }

    // Check for duplicate phone within the store (excluding current client)
    if (data.phone && storeId) {
      const duplicate = await repository.findByPhone(data.phone, storeId)
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestError("A client with this phone number already exists")
      }
    }

    const client = await repository.update(id, data, storeId)
    return mapClientToResponse(client)
  },

  delete: async (id: string, storeId?: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Client not found")
    }
    await repository.softDelete(id, storeId)
  },
})
