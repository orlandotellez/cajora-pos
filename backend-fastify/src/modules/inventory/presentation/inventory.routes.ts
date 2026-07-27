import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { inventoryController } from "./inventory.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateMovementDtoSchema, MovementQuerySchema } from "./inventory.dto"

const TAGS = ["Inventory"]

export const inventoryRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/low-stock", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, inventoryController.lowStock)

  fastify.get("/product/:productId", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, inventoryController.getByProduct)

  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(MovementQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, inventoryController.list)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateMovementDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, inventoryController.createMovement)
}
