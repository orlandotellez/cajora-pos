import { prisma } from "@/config/prisma"
import type { ICategoryRepository } from "../domain/categories.interface"
import type { ICategoryEntity, CreateCategoryData, UpdateCategoryData } from "../domain/categories.entities"
import { Prisma } from "@prisma/client"

const categorySelect = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const

type CategoryRecord = Prisma.categoryGetPayload<{ select: typeof categorySelect }>

function mapToEntity(category: CategoryRecord): ICategoryEntity {
  return {
    id: category.id,
    name: category.name,
    description: category.description || undefined,
    created_at: category.created_at,
    updated_at: category.updated_at,
    deleted_at: category.deleted_at || undefined,
  }
}

export const CategoryRepository: ICategoryRepository = {
  async findAll(params) {
    const where: Prisma.categoryWhereInput = {
      deleted_at: null,
      ...(params?.storeId && { store_id: params.storeId }),
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ]
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        select: {
          ...categorySelect,
          _count: { select: { products: true } },
        },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.category.count({ where }),
    ])

    return {
      categories: categories.map((c) => ({ ...mapToEntity(c), _count: c._count } as ICategoryEntity)),
      total,
      page,
      limit,
    }
  },

  async findById(id: string, storeId?: string) {
    const result = await prisma.category.findFirst({
      where: { id, deleted_at: null, ...(storeId && { store_id: storeId }) },
      select: {
        ...categorySelect,
        _count: { select: { products: true } },
      },
    })
    if (!result) return null
    return { ...mapToEntity(result), _count: result._count } as ICategoryEntity
  },

  async create(data: CreateCategoryData, storeId?: string) {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        store_id: storeId ?? "",
      },
      select: categorySelect,
    })
    return mapToEntity(category)
  },

  async update(id: string, data: UpdateCategoryData, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.categoryWhereUniqueInput & { store_id?: string }
    const category = await prisma.category.update({
      where,
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: categorySelect,
    })
    return mapToEntity(category)
  },

  async softDelete(id: string, storeId?: string) {
    const where = { id, ...(storeId && { store_id: storeId }) } as Prisma.categoryWhereUniqueInput & { store_id?: string }
    await prisma.category.update({
      where,
      data: { deleted_at: new Date() },
    })
  },

  async softDeleteMany(ids: string[], storeId?: string) {
    return prisma.category.updateMany({
      where: { id: { in: ids }, ...(storeId && { store_id: storeId }) },
      data: { deleted_at: new Date() },
    })
  },
}
