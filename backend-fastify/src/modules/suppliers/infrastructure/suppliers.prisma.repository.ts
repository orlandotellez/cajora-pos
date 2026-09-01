import { prisma } from "@/config/prisma"
import type { ISupplierRepository } from "../domain/suppliers.interface"
import type { ISupplierEntity, CreateSupplierData, UpdateSupplierData } from "../domain/suppliers.entities"
import { Prisma } from "@prisma/client"

const supplierSelect = {
  id: true,
  name: true,
  contact_name: true,
  email: true,
  phone: true,
  address: true,
  notes: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const

type SupplierRecord = Prisma.supplierGetPayload<{ select: typeof supplierSelect }>

function mapToEntity(supplier: SupplierRecord): ISupplierEntity {
  return {
    id: supplier.id,
    name: supplier.name,
    contact_name: supplier.contact_name || undefined,
    email: supplier.email || undefined,
    phone: supplier.phone || undefined,
    address: supplier.address || undefined,
    notes: supplier.notes || undefined,
    is_active: supplier.is_active,
    created_at: supplier.created_at,
    updated_at: supplier.updated_at,
    deleted_at: supplier.deleted_at || undefined,
  }
}

export const SupplierRepository: ISupplierRepository = {
  async findAll(params) {
    const where: Prisma.supplierWhereInput = {
      deleted_at: null,
      ...(params?.storeId && { store_id: params.storeId }),
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { contact_name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ]
    }

    if (params?.is_active !== undefined) {
      where.is_active = params.is_active
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        select: supplierSelect,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ])

    return {
      suppliers: suppliers.map(mapToEntity),
      total,
      page,
      limit,
    }
  },

  async findById(id: string, storeId?: string) {
    const result = await prisma.supplier.findFirst({
      where: { id, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: {
        ...supplierSelect,
        _count: { select: { products: true } },
      },
    })
    if (!result) return null
    return { ...mapToEntity(result), _count: result._count } as ISupplierEntity
  },

  async create(data: CreateSupplierData, storeId?: string) {
    const supplier = await prisma.supplier.create({
      data: {
        ...(storeId && { store_id: storeId }),
        name: data.name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        notes: data.notes,
        is_active: data.is_active ?? true,
      },
      select: supplierSelect,
    })
    return mapToEntity(supplier)
  },

  async update(id: string, data: UpdateSupplierData, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.supplierWhereUniqueInput & { store_id?: string }
    const supplier = await prisma.supplier.update({
      where,
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contact_name !== undefined && { contact_name: data.contact_name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
      select: supplierSelect,
    })
    return mapToEntity(supplier)
  },

  async softDelete(id: string, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.supplierWhereUniqueInput & { store_id?: string }
    await prisma.supplier.update({
      where,
      data: { deleted_at: new Date() },
    })
  },

  async softDeleteMany(ids: string[], storeId?: string) {
    return prisma.supplier.updateMany({
      where: { id: { in: ids }, ...(storeId && { store_id: storeId }) },
      data: { deleted_at: new Date() },
    })
  },
}
