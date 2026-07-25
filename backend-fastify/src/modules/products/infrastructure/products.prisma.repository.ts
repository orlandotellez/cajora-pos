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
    supplier_id: product.supplier_id || undefined,
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

  async updateStock(id: string, quantity: number, storeId?: string) {
    const product = await prisma.product.update({
      where: { id, ...(storeId ? { store_id: storeId } : {}) },
      data: { stock: { increment: quantity } },
      select: productSelect,
    })
    return mapToEntity(product)
  },
}
