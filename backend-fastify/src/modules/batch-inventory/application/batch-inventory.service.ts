import { prisma } from "@/config/prisma"
import { NotFoundError, BadRequestError, ConflictError } from "@/core/errors/AppError"
import type { IBatchInventoryRepository } from "../domain/batch-inventory.interface"
import type { IProductRepository } from "../../products/domain/products.interface"
import type { IBatchResponse, IBatchListResponse } from "../domain/batch-inventory.types"
import type { CreateBatchData } from "../domain/batch-inventory.entities"

interface RichBatchItem {
  id: string
  product_id: string
  quantity: number
  unit_cost?: unknown
  notes?: string | null
  product?: { name: string }
}

interface RichBatch {
  id: string
  movement_type: string
  supplier_id?: string | null
  notes?: string | null
  user_id: string
  created_at: Date
  items?: RichBatchItem[]
  supplier?: { name: string } | null
  user?: { name: string } | null
}

function mapBatchToResponse(batch: RichBatch): IBatchResponse {
  const items = (batch.items || []).map((item: RichBatchItem) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name,
    quantity: item.quantity,
    unit_cost: item.unit_cost ? Number(item.unit_cost) : null,
    notes: item.notes || null,
  }))

  const total_items = items.length
  const total_quantity = items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)

  return {
    id: batch.id,
    movement_type: batch.movement_type,
    supplier_id: batch.supplier_id || null,
    supplier_name: batch.supplier?.name,
    notes: batch.notes || null,
    user_id: batch.user_id,
    user_name: batch.user?.name,
    items,
    total_items,
    total_quantity,
    created_at: batch.created_at instanceof Date ? batch.created_at.toISOString() : batch.created_at,
  }
}

export const createBatchInventoryService = (
  batchInventoryRepository: IBatchInventoryRepository,
  productRepository: IProductRepository
) => ({
  create: async (data: CreateBatchData): Promise<IBatchResponse> => {
    const products = await Promise.all(
      data.items.map(item => productRepository.findById(item.product_id))
    )

    for (let i = 0; i < data.items.length; i++) {
      const product = products[i]
      if (!product || product.deleted_at) {
        throw new NotFoundError(`Product ${data.items[i].product_id} not found`)
      }
    }

    if (data.movement_type === "salida") {
      for (let i = 0; i < data.items.length; i++) {
        const product = products[i]!
        if (product.stock < data.items[i].quantity) {
          throw new BadRequestError(`Insufficient stock for product ${product.name}`)
        }
      }
    }

    let expenseSessionId: string | null = null
    let expenseTotal = 0
    if (data.paid_cash) {
      if (data.movement_type !== "entrada") {
        throw new BadRequestError("Solo las entradas pueden pagarse en efectivo desde la caja")
      }
      expenseTotal = Math.round(
        data.items.reduce((sum, item) => sum + (item.unit_cost ?? 0) * item.quantity, 0) * 100
      ) / 100
      if (expenseTotal <= 0) {
        throw new BadRequestError("Para pagar en efectivo necesitás el costo de al menos un ítem")
      }

      const own = await prisma.cash_session.findFirst({
        where: { user_id: data.user_id, store_id: data.store_id!, status: "abierto", deleted_at: null },
      })
      if (own) {
        expenseSessionId = own.id
      } else {
        const open = await prisma.cash_session.findMany({
          where: { store_id: data.store_id!, status: "abierto", deleted_at: null },
        })
        if (open.length === 0) {
          throw new ConflictError("No hay una caja abierta. Abrí la caja para registrar compras en efectivo")
        }
        if (open.length > 1) {
          throw new ConflictError("Hay varias cajas abiertas: abrí tu propia caja para registrar compras en efectivo")
        }
        expenseSessionId = open[0]!.id
      }
    }

    const batch = await prisma.$transaction(async (tx) => {
      if (expenseSessionId) {
        const session = await tx.cash_session.findUnique({
          where: { id: expenseSessionId },
          select: { status: true },
        })
        if (!session || session.status !== "abierto") {
          throw new ConflictError("La caja se cerró mientras se registraba la compra. Volvé a intentar")
        }
      }

      const created = await tx.inventory_batch.create({
        data: {
          movement_type: data.movement_type,
          supplier_id: data.supplier_id,
          notes: data.notes,
          user_id: data.user_id,
          store_id: data.store_id!,
          items: {
            create: data.items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: {
            include: { product: { select: { name: true } } },
          },
          supplier: { select: { name: true } },
          user: { select: { name: true } },
        },
      })

      for (const item of data.items) {
        const stockAdjustment = data.movement_type === "entrada"
          ? item.quantity
          : data.movement_type === "salida"
            ? -item.quantity
            : item.quantity

        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { increment: stockAdjustment } },
        })

        await tx.inventory_movement.create({
          data: {
            product_id: item.product_id,
            movement_type: data.movement_type,
            quantity: item.quantity,
            unit_cost: item.unit_cost ?? null,
            note: data.notes,
            batch_id: created.id,
            user_id: data.user_id,
            store_id: data.store_id!,
          },
        })
      }

      if (expenseSessionId) {
        const userName = await tx.user.findUnique({
          where: { id: data.user_id },
          select: { name: true },
        })
        await tx.cash_expense.create({
          data: {
            session_id: expenseSessionId,
            amount: expenseTotal,
            reason: "compra_inventario",
            source_type: "inventory_batch",
            ref_id: created.id,
            description: data.notes?.trim() || `Compra por lote (${data.items.length} ítems)`,
            user_id: data.user_id,
            user_name: userName?.name ?? "—",
            store_id: data.store_id!,
          },
        })
      }

      return created
    })

    return mapBatchToResponse(batch)
  },

  getById: async (id: string, storeId?: string): Promise<IBatchResponse> => {
    const where: { id: string; store_id?: string } = { id }
    if (storeId) where.store_id = storeId
    const batch = await prisma.inventory_batch.findFirst({
      where,
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
        supplier: { select: { name: true } },
        user: { select: { name: true } },
      },
    })

    if (!batch) throw new NotFoundError("Batch not found")
    return mapBatchToResponse(batch)
  },

  list: async (params?: { movement_type?: string; supplier_id?: string; page?: number; limit?: number; storeId?: string }): Promise<IBatchListResponse> => {
    const where: { movement_type?: string; supplier_id?: string; store_id?: string } = {}
    if (params?.movement_type) where.movement_type = params.movement_type
    if (params?.supplier_id) where.supplier_id = params.supplier_id
    if (params?.storeId) where.store_id = params.storeId

    const page = params?.page || 1
    const limit = params?.limit || 50
    const skip = (page - 1) * limit

    const [batches, total] = await Promise.all([
      prisma.inventory_batch.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { name: true } } },
          },
          supplier: { select: { name: true } },
          user: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.inventory_batch.count({ where }),
    ])

    return {
      batches: batches.map((b) => mapBatchToResponse(b as unknown as RichBatch)),
      total,
      page,
      limit,
    }
  },
})
