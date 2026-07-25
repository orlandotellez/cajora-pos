import { NotFoundError, ConflictError } from "@/core/errors/AppError"
import type { IProductRepository } from "../domain/products.interface"
import type { IProductResponse, IProductListResponse, IProductCategory } from "../domain/products.types"
import type { CreateProductData, UpdateProductData, IProductEntity } from "../domain/products.entities"

/** Extended entity shape that includes joined category/supplier data from the Prisma query */
interface RichProductEntity extends IProductEntity {
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
}

function mapProductToResponse(product: RichProductEntity): IProductResponse {
  return {
    id: product.id,
    barcode: product.barcode || undefined,
    name: product.name,
    unit_type: product.unit_type || undefined,
    unit_quantity: product.unit_quantity ?? undefined,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : undefined,
    supplier: product.supplier
      ? { id: product.supplier.id, name: product.supplier.name }
      : undefined,
    price: Number(product.price),
    cost: Number(product.cost),
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    active: product.active,
    created_at: product.created_at instanceof Date ? product.created_at.toISOString() : product.created_at,
    updated_at: product.updated_at instanceof Date ? product.updated_at.toISOString() : product.updated_at,
  }
}

export const createProductService = (repository: IProductRepository) => ({
  list: async (params?: { search?: string; category_id?: string; active?: boolean; lowStock?: boolean; outOfStock?: boolean; page?: number; limit?: number; storeId?: string }): Promise<IProductListResponse> => {
    const result = await repository.findAll(params)
    return {
      products: result.products.map(mapProductToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getById: async (id: string, storeId?: string): Promise<IProductResponse> => {
    const product = await repository.findById(id, storeId)
    if (!product || product.deleted_at) {
      throw new NotFoundError("Product not found")
    }
    return mapProductToResponse(product)
  },

  getByBarcode: async (barcode: string, storeId?: string): Promise<IProductResponse | null> => {
    const product = await repository.findByBarcode(barcode, storeId)
    if (!product || product.deleted_at) {
      return null
    }
    return mapProductToResponse(product)
  },

  create: async (data: CreateProductData, storeId?: string): Promise<IProductResponse> => {
    if (data.barcode) {
      const existing = await repository.findByBarcode(data.barcode, storeId)
      if (existing) {
        throw new ConflictError("A product with this barcode already exists")
      }
    }

    const product = await repository.create(data, storeId)
    return mapProductToResponse(product)
  },

  update: async (id: string, data: UpdateProductData, storeId?: string): Promise<IProductResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Product not found")
    }

    if (data.barcode && data.barcode !== existing.barcode) {
      const duplicate = await repository.findByBarcode(data.barcode, storeId)
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("A product with this barcode already exists")
      }
    }

    const product = await repository.update(id, data, storeId)
    return mapProductToResponse(product)
  },

  delete: async (id: string, storeId?: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing || existing.deleted_at) {
      throw new NotFoundError("Product not found")
    }
    await repository.softDelete(id, storeId)
  }
})
