import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { servicesController } from "./services.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { permissionGuard } from "@/core/guard/permission.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateServiceDtoSchema, UpdateServiceDtoSchema, ServiceQuerySchema, BulkDeleteServicesDtoSchema } from "./services.dto"

const TAGS = ["Services"]

export const servicesRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(ServiceQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, servicesController.list)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, servicesController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateServiceDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, servicesController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateServiceDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, servicesController.update)

  fastify.post("/bulk-delete", {
    schema: { tags: TAGS, body: toJsonSchema(BulkDeleteServicesDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, servicesController.deleteMany)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, servicesController.delete)
}
