import type { IProductEntity, CreateProductData, UpdateProductData } from "./products.entities"

export interface IProductRepository {
  findAll(params?: { search?: string; category_id?: string; active?: boolean; lowStock?: boolean; outOfStock?: boolean; unitType?: string; page?: number; limit?: number; storeId?: string }): Promise<{ products: IProductEntity[]; total: number; page: number; limit: number }>
  findById(id: string, storeId?: string): Promise<IProductEntity | null>
  findByBarcode(barcode: string, storeId?: string): Promise<IProductEntity | null>
  findByBarcodes(barcodes: string[], storeId?: string): Promise<{ barcode: string }[]>
  resolveCategoryNames(names: string[], storeId?: string): Promise<{ name: string; id: string }[]>
  resolveSupplierNames(names: string[], storeId?: string): Promise<{ name: string; id: string }[]>
  create(data: CreateProductData, storeId?: string): Promise<IProductEntity>
  createMany(data: CreateProductData[], storeId?: string): Promise<{ count: number }>
  update(id: string, data: UpdateProductData, storeId?: string): Promise<IProductEntity>
  softDelete(id: string, storeId?: string): Promise<void>
  softDeleteMany(ids: string[], storeId?: string): Promise<{ count: number }>
  softDeleteAllByFilters(filters?: { search?: string; category_id?: string; active?: boolean; lowStock?: boolean; outOfStock?: boolean; storeId?: string }): Promise<{ count: number }>
  updateStock(id: string, quantity: number, storeId?: string): Promise<IProductEntity>
}
