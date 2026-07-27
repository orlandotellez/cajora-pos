import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { categoriesController } from "./categories.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateCategoryDtoSchema, UpdateCategoryDtoSchema, CategoryQuerySchema } from "./categories.dto"

const TAGS = ["Categories"]

export const categoriesRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.listSimple)

  fastify.get("/paginated", {
    schema: { tags: TAGS, querystring: toJsonSchema(CategoryQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.list)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateCategoryDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateCategoryDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.update)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, categoriesController.delete)
}
