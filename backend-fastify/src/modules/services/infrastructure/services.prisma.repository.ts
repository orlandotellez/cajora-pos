import { prisma } from "@/config/prisma"
import type { IServiceRepository } from "../domain/services.interface"
import type { IServiceEntity, CreateServiceData, UpdateServiceData } from "../domain/services.entities"
import { Prisma } from "@prisma/client"

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  base_price: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  service_products: {
    select: {
      id: true,
      product_id: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  },
}

type ServiceRecord = Prisma.serviceGetPayload<{ select: typeof serviceSelect }>
type ServiceProductRecord = Prisma.service_productGetPayload<{ select: { id: true; product_id: true; quantity: true; product: { select: { id: true; name: true; price: true } } } }>

function mapToEntity(service: ServiceRecord): IServiceEntity {
  return {
    id: service.id,
    name: service.name,
    description: service.description || undefined,
    base_price: service.base_price,
    is_active: service.is_active,
    created_at: service.created_at,
    updated_at: service.updated_at,
    deleted_at: service.deleted_at || undefined,
    service_products: service.service_products?.map((sp: ServiceProductRecord) => ({
      id: sp.id,
      service_id: service.id,
      product_id: sp.product_id,
      quantity: sp.quantity,
      product: sp.product
        ? { id: sp.product.id, name: sp.product.name, price: sp.product.price }
        : undefined,
    })),
  }
}

export const ServiceRepository: IServiceRepository = {
  async findAll(params) {
    const where: Prisma.serviceWhereInput = { deleted_at: null, ...(params?.storeId && { store_id: params.storeId }) }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
      ]
    }

    if (params?.active !== undefined) {
      where.is_active = params.active
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        select: serviceSelect,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.service.count({ where }),
    ])

    return {
      services: services.map(mapToEntity),
      total,
      page,
      limit,
    }
  },

  async findById(id: string, storeId?: string) {
    const service = await prisma.service.findFirst({
      where: { id, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: serviceSelect,
    })
    if (!service) return null
    return mapToEntity(service)
  },

  async create(data: CreateServiceData, storeId?: string) {
    const service = await prisma.service.create({
      data: {
        ...(storeId && { store_id: storeId }),
        name: data.name,
        description: data.description,
        base_price: data.base_price,
        is_active: data.is_active ?? true,
        ...(data.products && data.products.length > 0
          ? {
              service_products: {
                create: data.products.map((p) => ({
                  product_id: p.product_id,
                  quantity: p.quantity,
                })),
              },
            }
          : {}),
      },
      select: serviceSelect,
    })
    return mapToEntity(service)
  },

  async update(id: string, data: UpdateServiceData, storeId?: string) {
    // If products are provided, replace them
    if (data.products !== undefined) {
      await prisma.service_product.deleteMany({ where: { service_id: id } })

      if (data.products.length > 0) {
        await prisma.service_product.createMany({
          data: data.products.map((p) => ({
            service_id: id,
            product_id: p.product_id,
            quantity: p.quantity,
          })),
        })
      }
    }

    const service = await prisma.service.update({
      where: { id, ...(storeId && { store_id: storeId }) },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.base_price !== undefined && { base_price: data.base_price }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
      select: serviceSelect,
    })
    return mapToEntity(service)
  },

  async softDelete(id: string, storeId?: string) {
    await prisma.service.update({
      where: { id, ...(storeId && { store_id: storeId }) },
      data: { deleted_at: new Date() },
    })
  },

  async softDeleteMany(ids: string[], storeId?: string) {
    return prisma.service.updateMany({
      where: { id: { in: ids }, ...(storeId && { store_id: storeId }) },
      data: { deleted_at: new Date() },
    })
  },
}
