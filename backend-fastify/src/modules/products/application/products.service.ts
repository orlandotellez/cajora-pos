import { NotFoundError, ConflictError } from "@/core/errors/AppError"
import type { IProductRepository } from "../domain/products.interface"
import type { IProductResponse, IProductListResponse, IProductCategory } from "../domain/products.types"
import type { CreateProductData, UpdateProductData, IProductEntity } from "../domain/products.entities"
import type { ImportProductRowDto } from "../presentation/products.dto"

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
  },

  deleteMany: async (ids: string[], storeId?: string): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteMany(ids, storeId)
    return { deleted: result.count }
  },

  deleteAllByFilters: async (filters?: { search?: string; category_id?: string; active?: boolean; lowStock?: boolean; outOfStock?: boolean; storeId?: string }): Promise<{ deleted: number }> => {
    const result = await repository.softDeleteAllByFilters(filters)
    return { deleted: result.count }
  },

  importMany: async (
    rows: ImportProductRowDto[],
    storeId: string,
  ): Promise<{ imported: number; errors: { row: number; message: string }[] }> => {
    const errors: { row: number; message: string }[] = []
    const clean: ImportProductRowDto[] = []

    const seenBarcodes = new Set<string>()
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.barcode) {
        if (seenBarcodes.has(row.barcode)) {
          errors.push({ row: i + 1, message: `Barcode duplicado dentro del archivo: ${row.barcode}` })
          continue
        }
        seenBarcodes.add(row.barcode)
      }
      clean.push(row)
    }

    if (clean.length === 0) {
      return { imported: 0, errors }
    }

    const barcodes = clean.map((p) => p.barcode).filter((b): b is string => !!b)
    const existing = await repository.findByBarcodes(barcodes, storeId)
    const existingSet = new Set(existing.map((e) => e.barcode))
    const deduped: ImportProductRowDto[] = []
    for (let i = 0; i < clean.length; i++) {
      const row = clean[i]
      if (row.barcode && existingSet.has(row.barcode)) {
        errors.push({ row: i + 1, message: `Barcode ya existe en la tienda: ${row.barcode}` })
        continue
      }
      deduped.push(row)
    }

    if (deduped.length === 0) {
      return { imported: 0, errors }
    }

    const categoryNames = [...new Set(deduped.map((p) => p.category_name).filter((n): n is string => !!n))]
    const supplierNames = [...new Set(deduped.map((p) => p.supplier_name).filter((n): n is string => !!n))]

    const categoryMap = new Map<string, string>() // name -> id
    const supplierMap = new Map<string, string>() // name -> id

    if (categoryNames.length > 0) {
      const resolved = await repository.resolveCategoryNames(categoryNames, storeId)
      resolved.forEach((c) => categoryMap.set(c.name, c.id))
    }

    if (supplierNames.length > 0) {
      const resolved = await repository.resolveSupplierNames(supplierNames, storeId)
      resolved.forEach((s) => supplierMap.set(s.name, s.id))
    }

    const finalRows: CreateProductData[] = []
    for (let i = 0; i < deduped.length; i++) {
      const p = deduped[i]
      const categoryId = p.category_name ? categoryMap.get(p.category_name) : undefined
      const supplierId = p.supplier_name ? supplierMap.get(p.supplier_name) : undefined

      if (p.supplier_name && !supplierId) {
        errors.push({ row: i + 1, message: `Proveedor no encontrado: ${p.supplier_name}` })
        continue
      }

      finalRows.push({
        barcode: p.barcode,
        name: p.name,
        unit_type: p.unit_type,
        unit_quantity: p.unit_quantity,
        category_id: categoryId,
        supplier_id: supplierId,
        price: p.price,
        cost: p.cost ?? 0,
        stock: p.stock ?? 0,
        low_stock_threshold: p.low_stock_threshold ?? 5,
        active: p.active ?? true,
      })
    }

    let imported = 0
    if (finalRows.length > 0) {
      const result = await repository.createMany(finalRows, storeId)
      imported = result.count
    }

    return { imported, errors }
  },
})
