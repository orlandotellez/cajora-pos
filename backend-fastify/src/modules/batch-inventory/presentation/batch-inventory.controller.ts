import type { FastifyReply, FastifyRequest } from "fastify"
import { createBatchInventoryService } from "../application/batch-inventory.service"
import { BatchInventoryRepository } from "../infrastructure/batch-inventory.prisma.repository"
import { ProductRepository } from "../../products/infrastructure/products.prisma.repository"
import { CreateBatchDtoSchema, BatchQuerySchema } from "./batch-inventory.dto"
import { UnauthorizedError } from "@/core/errors/AppError"
import { sseBroadcast } from "@/config/sse"

const batchInventoryService = createBatchInventoryService(BatchInventoryRepository, ProductRepository)

export const batchInventoryController = {
  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId
    if (!userId) throw new UnauthorizedError("Authentication required")

    const data = CreateBatchDtoSchema.parse(request.body)
    const result = await batchInventoryService.create({ ...data, user_id: userId, store_id: request.storeId })
    sseBroadcast(request.storeId!, "inventory.batch.created", { id: result.id })
    return reply.status(201).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await batchInventoryService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = BatchQuerySchema.parse(request.query)
    const result = await batchInventoryService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },
}
