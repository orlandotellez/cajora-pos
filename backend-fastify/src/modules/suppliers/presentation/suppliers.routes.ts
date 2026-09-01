import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { suppliersController } from "./suppliers.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateSupplierDtoSchema, UpdateSupplierDtoSchema, SupplierQuerySchema, BulkDeleteSuppliersDtoSchema } from "./suppliers.dto"

const TAGS = ["Suppliers"]

export const suppliersRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(SupplierQuerySchema) },
    preHandler: [authGuard, storeGuard],
  },
  suppliersController.list)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, suppliersController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateSupplierDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, suppliersController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateSupplierDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, suppliersController.update)

  fastify.post("/bulk-delete", {
    schema: { tags: TAGS, body: toJsonSchema(BulkDeleteSuppliersDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, suppliersController.deleteMany)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, suppliersController.delete)
}
