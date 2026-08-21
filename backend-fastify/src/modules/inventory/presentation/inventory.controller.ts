import type { FastifyReply, FastifyRequest } from "fastify"
import { createInventoryService } from "../application/inventory.service"
import { InventoryRepository } from "../infrastructure/inventory.prisma.repository"
import { ProductRepository } from "../../products/infrastructure/products.prisma.repository"
import { createCashRegisterService } from "../../cash-register/application/cash-register.service"
import { CashRegisterRepository } from "../../cash-register/infrastructure/cash-register.prisma.repository"
import { CreateMovementDtoSchema, MovementQuerySchema } from "./inventory.dto"
import { UnauthorizedError } from "@/core/errors/AppError"
import { sseBroadcast } from "@/config/sse"

const cashRegisterService = createCashRegisterService(CashRegisterRepository)
const inventoryService = createInventoryService(InventoryRepository, ProductRepository, cashRegisterService)

export const inventoryController = {
  createMovement: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId
    if (!userId) throw new UnauthorizedError("Authentication required")

    const data = CreateMovementDtoSchema.parse(request.body)
    const result = await inventoryService.create({ ...data, user_id: userId, store_id: request.storeId })
    sseBroadcast(request.storeId!, "inventory.movement.created", { id: result.id })
    return reply.status(201).send(result)
  },

  getByProduct: async (request: FastifyRequest, reply: FastifyReply) => {
    const { productId } = request.params as { productId: string }
    const result = await inventoryService.getByProduct(productId, request.storeId)
    return reply.status(200).send(result)
  },

  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = MovementQuerySchema.parse(request.query)
    const result = await inventoryService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },

  lowStock: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await inventoryService.getLowStockProducts(ProductRepository)
    return reply.status(200).send({ products: result })
  },
}
