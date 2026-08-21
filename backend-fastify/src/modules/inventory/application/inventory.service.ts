import { NotFoundError, BadRequestError } from "@/core/errors/AppError"
import type { IInventoryRepository, ICashIntegrationPort } from "../domain/inventory.interface"
import type { IProductRepository } from "../../products/domain/products.interface"
import type { IInventoryMovementResponse, IInventoryMovementListResponse, IProductStockResponse } from "../domain/inventory.types"
import type { CreateMovementData, IInventoryMovementEntity } from "../domain/inventory.entities"

function mapMovementToResponse(movement: IInventoryMovementEntity, productName?: string): IInventoryMovementResponse {
  return {
    id: movement.id,
    product_id: movement.product_id,
    product_name: productName || movement.product_name,
    movement_type: movement.movement_type,
    quantity: movement.quantity,
    unit_cost: movement.unit_cost ?? null,
    note: movement.note || undefined,
    user_id: movement.user_id,
    created_at: movement.created_at instanceof Date ? movement.created_at.toISOString() : movement.created_at,
  }
}

export const createInventoryService = (
  movementRepository: IInventoryRepository,
  productRepository: IProductRepository,
  cashPort?: ICashIntegrationPort
) => ({
  create: async (data: CreateMovementData): Promise<IInventoryMovementResponse> => {
    const product = await productRepository.findById(data.product_id)
    if (!product || product.deleted_at) {
      throw new NotFoundError("Product not found")
    }

    if (data.movement_type === "salida" && product.stock < data.quantity) {
      throw new BadRequestError("Insufficient stock")
    }

    let expenseSessionId: string | null = null
    if (data.paid_cash) {
      if (!cashPort) throw new BadRequestError("Integración de caja no disponible")
      if (data.movement_type !== "entrada") {
        throw new BadRequestError("Solo las entradas pueden pagarse en efectivo desde la caja")
      }
      if (!data.unit_cost || data.unit_cost <= 0) {
        throw new BadRequestError("Para pagar en efectivo necesitás el costo unitario del producto")
      }
      const { session_id } = await cashPort.resolveExpenseSession({
        storeId: data.store_id!,
        userId: data.user_id,
      })
      expenseSessionId = session_id
    }

    const stockAdjustment = data.movement_type === "entrada"
      ? data.quantity
      : data.movement_type === "salida"
        ? -data.quantity
        : data.quantity

    await productRepository.updateStock(data.product_id, stockAdjustment)

    const movement = await movementRepository.create(data)

    if (expenseSessionId && cashPort) {
      await cashPort.registerExpense({
        session_id: expenseSessionId,
        store_id: data.store_id!,
        user_id: data.user_id,
        amount: Math.round(data.unit_cost! * data.quantity * 100) / 100,
        reason: "compra_inventario",
        source_type: "inventory_movement",
        ref_id: movement.id,
        description: `Compra: ${product.name} x${data.quantity}`,
      })
    }

    return mapMovementToResponse(movement, product.name)
  },

  getByProduct: async (productId: string, storeId?: string): Promise<IInventoryMovementListResponse> => {
    const product = await productRepository.findById(productId)
    if (!product || product.deleted_at) {
      throw new NotFoundError("Product not found")
    }

    const movements = await movementRepository.findByProductId(productId, { storeId })
    return {
      movements: movements.map(m => mapMovementToResponse(m, product.name)),
      total: movements.length,
      page: 1,
      limit: movements.length,
    }
  },

  list: async (params?: { product_id?: string; movement_type?: string; page?: number; limit?: number; storeId?: string }): Promise<IInventoryMovementListResponse> => {
    const result = await movementRepository.findAll(params)
    return {
      movements: result.movements.map(m => mapMovementToResponse(m)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  },

  getLowStockProducts: async (productRepo: IProductRepository): Promise<IProductStockResponse[]> => {
    const { products } = await productRepo.findAll({ lowStock: true, limit: 200 })
    return products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      current_stock: p.stock,
      low_stock_threshold: p.low_stock_threshold,
      is_low_stock: p.stock <= p.low_stock_threshold,
    }))
  },
})
