import { prisma } from "@/config/prisma"
import type { IProductRepository } from "../domain/products.interface"
import type { IProductEntity, CreateProductData, UpdateProductData } from "../domain/products.entities"
import { Prisma, type UNIT_TYPE } from "@prisma/client"

const productSelect = {
  id: true,
  barcode: true,
  name: true,
  unit_type: true,
  unit_quantity: true,
  category_id: true,
  supplier_id: true,
  price: true,
  cost: true,
  stock: true,
  low_stock_threshold: true,
  active: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
}

type ProductRecord = Prisma.productGetPayload<{ select: typeof productSelect }>

function mapToEntity(product: ProductRecord): IProductEntity {
  return {
    id: product.id,
    barcode: product.barcode || undefined,
    name: product.name,
    unit_type: product.unit_type || undefined,
    unit_quantity: product.unit_quantity ?? undefined,
    category_id: product.category_id || undefined,
    category_name: product.category?.name || undefined,
    category: product.category,
    supplier_id: product.supplier_id || undefined,
    supplier: product.supplier,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    active: product.active,
    created_at: product.created_at,
    updated_at: product.updated_at,
    deleted_at: product.deleted_at || undefined,
  }
}

export const ProductRepository: IProductRepository = {
  async findAll(params) {
    const where: Prisma.productWhereInput = {
      deleted_at: null,
    }

    if (params?.storeId) {
      where.store_id = params.storeId
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { barcode: { contains: params.search, mode: "insensitive" } },
        { category: { name: { contains: params.search, mode: "insensitive" } } },
      ]
    }

    if (params?.category_id) {
      where.category_id = params.category_id
    }

    if (params?.active !== undefined) {
      where.active = params.active
    }

    if (params?.lowStock) {
      where.stock = { lte: prisma.product.fields.low_stock_threshold }
    }

    if (params?.outOfStock) {
      where.stock = { lte: 0 }
    }

    if (params?.unitType) {
      where.unit_type = params.unitType
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: productSelect,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ])

    return {
      products: products.map(mapToEntity),
      total,
      page,
      limit,
    }
  },

  async findById(id: string, storeId?: string) {
    const product = await prisma.product.findFirst({
      where: { id, deleted_at: null, ...(storeId ? { store_id: storeId } : {}) },
      select: productSelect,
    })
    if (!product) return null
    return mapToEntity(product)
  },

  async findByBarcode(barcode: string, storeId?: string) {
    const product = await prisma.product.findFirst({
      where: { barcode, deleted_at: null, ...(storeId ? { store_id: storeId } : {}) },
      select: productSelect,
    })
    if (!product) return null
    return mapToEntity(product)
  },

  async findByBarcodes(barcodes: string[], storeId?: string) {
    // Sólo barcodes no vacíos
    const codes = barcodes.filter((b) => b && b.length > 0)
    if (codes.length === 0) return []
    const existing = await prisma.product.findMany({
      where: {
        barcode: { in: codes },
        deleted_at: null,
        ...(storeId ? { store_id: storeId } : {}),
      },
      select: { barcode: true },
    })
    return existing.map((p) => ({ barcode: p.barcode as string }))
  },

  async resolveCategoryNames(names: string[], storeId?: string) {
    if (names.length === 0) return []
    const existing = await prisma.category.findMany({
      where: { store_id: storeId, name: { in: names } },
      select: { id: true, name: true, deleted_at: true },
    })
    const map = new Map(existing.map((c) => [c.name, c.id]))
    const missing = names.filter((n) => !map.has(n))
    if (missing.length > 0) {
      await prisma.category.createMany({
        data: missing.map((name) => ({ name, store_id: storeId ?? "" })),
        skipDuplicates: true,
      })
    }
    const toReactivate = existing.filter((c) => c.deleted_at !== null).map((c) => c.id)
    if (toReactivate.length > 0) {
      await prisma.category.updateMany({
        where: { id: { in: toReactivate }, store_id: storeId },
        data: { deleted_at: null },
      })
    }
    const fresh = await prisma.category.findMany({
      where: { store_id: storeId, name: { in: names } },
      select: { id: true, name: true },
    })
    fresh.forEach((c) => map.set(c.name, c.id))
    return [...map.entries()].map(([name, id]) => ({ name, id }))
  },

  async resolveSupplierNames(names: string[], storeId?: string) {
    if (names.length === 0) return []
    const existing = await prisma.supplier.findMany({
      where: { store_id: storeId, name: { in: names } },
      select: { id: true, name: true, deleted_at: true },
    })
    const map = new Map(existing.map((c) => [c.name, c.id]))
    const missing = names.filter((n) => !map.has(n))
    if (missing.length > 0) {
      await prisma.supplier.createMany({
        data: missing.map((name) => ({ name, store_id: storeId ?? "", is_active: true })),
        skipDuplicates: true,
      })
    }
    const toReactivate = existing.filter((c) => c.deleted_at !== null).map((c) => c.id)
    if (toReactivate.length > 0) {
      await prisma.supplier.updateMany({
        where: { id: { in: toReactivate }, store_id: storeId },
        data: { deleted_at: null },
      })
    }
    const fresh = await prisma.supplier.findMany({
      where: { store_id: storeId, name: { in: names } },
      select: { id: true, name: true },
    })
    fresh.forEach((c) => map.set(c.name, c.id))
    return [...map.entries()].map(([name, id]) => ({ name, id }))
  },

  async createMany(data: CreateProductData[], storeId?: string) {
    const result = await prisma.product.createMany({
      data: data.map((d) => ({
        barcode: d.barcode ?? null,
        name: d.name,
        unit_type: d.unit_type as UNIT_TYPE | undefined | null,
        unit_quantity: d.unit_quantity,
        category_id: d.category_id,
        supplier_id: d.supplier_id,
        store_id: storeId ?? "",
        price: d.price,
        cost: d.cost ?? 0,
        stock: d.stock ?? 0,
        low_stock_threshold: d.low_stock_threshold ?? 5,
        active: d.active ?? true,
      })),
    })
    return { count: result.count }
  },

  async create(data: CreateProductData, storeId?: string) {
    const product = await prisma.product.create({
      data: {
        barcode: data.barcode,
        name: data.name,
        unit_type: data.unit_type as UNIT_TYPE | undefined | null,
        unit_quantity: data.unit_quantity,
        category_id: data.category_id,
        supplier_id: data.supplier_id,
        store_id: storeId ?? "",
        price: data.price,
        cost: data.cost ?? 0,
        stock: data.stock ?? 0,
        low_stock_threshold: data.low_stock_threshold ?? 5,
        active: data.active ?? true,
      },
      select: productSelect,
    })
    return mapToEntity(product)
  },

  async update(id: string, data: UpdateProductData, storeId?: string) {
    const product = await prisma.product.update({
      where: { id, ...(storeId ? { store_id: storeId } : {}) },
      data: {
        ...(data.barcode !== undefined && { barcode: data.barcode }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.unit_type !== undefined && { unit_type: data.unit_type as UNIT_TYPE | null }),
        ...(data.unit_quantity !== undefined && { unit_quantity: data.unit_quantity }),
        ...(data.category_id !== undefined && { category_id: data.category_id }),
        ...(data.supplier_id !== undefined && { supplier_id: data.supplier_id }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.cost !== undefined && { cost: data.cost }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.low_stock_threshold !== undefined && { low_stock_threshold: data.low_stock_threshold }),
        ...(data.active !== undefined && { active: data.active }),
      },
      select: productSelect,
    })
    return mapToEntity(product)
  },

  async softDelete(id: string, storeId?: string) {
    await prisma.product.update({
      where: { id, ...(storeId ? { store_id: storeId } : {}) },
      data: { deleted_at: new Date() },
    })
  },

  async softDeleteMany(ids: string[], storeId?: string) {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids }, deleted_at: null, ...(storeId ? { store_id: storeId } : {}) },
      data: { deleted_at: new Date() },
    })
    return { count: result.count }
  },

  async softDeleteAllByFilters(filters?: { search?: string; category_id?: string; active?: boolean; lowStock?: boolean; outOfStock?: boolean; storeId?: string }) {
    const where: Prisma.productWhereInput = {
      deleted_at: null,
    }

    if (filters?.storeId) {
      where.store_id = filters.storeId
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { barcode: { contains: filters.search, mode: "insensitive" } },
        { category: { name: { contains: filters.search, mode: "insensitive" } } },
      ]
    }

    if (filters?.category_id) {
      where.category_id = filters.category_id
    }

    if (filters?.active !== undefined) {
      where.active = filters.active
    }

    if (filters?.lowStock) {
      where.stock = { lte: prisma.product.fields.low_stock_threshold }
    }

    if (filters?.outOfStock) {
      where.stock = { lte: 0 }
    }

    const result = await prisma.product.updateMany({
      where,
      data: { deleted_at: new Date() },
    })
    return { count: result.count }
  },

  async updateStock(id: string, quantity: number, storeId?: string) {
    const product = await prisma.product.update({
      where: { id, ...(storeId ? { store_id: storeId } : {}) },
      data: { stock: { increment: quantity } },
      select: productSelect,
    })
    return mapToEntity(product)
  },
}
