import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { batchInventoryController } from "./batch-inventory.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateBatchDtoSchema, BatchQuerySchema } from "./batch-inventory.dto"

const TAGS = ["Inventory Batches"]

export const batchInventoryRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(BatchQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, batchInventoryController.list)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, batchInventoryController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateBatchDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, batchInventoryController.create)
}
