import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { productsController } from "./products.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { permissionGuard } from "@/core/guard/permission.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateProductDtoSchema, UpdateProductDtoSchema, ProductQuerySchema, ImportProductsDtoSchema, BulkDeleteProductsDtoSchema, DeleteAllProductsQuerySchema } from "./products.dto"

const TAGS = ["Products"]

export const productsRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(ProductQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, productsController.list)

  fastify.get("/barcode/:barcode", {
    schema: {
      tags: TAGS,
      params: {
        type: "object",
        properties: { barcode: { type: "string" } },
        required: ["barcode"],
      },
    },
    preHandler: [authGuard, storeGuard],
  }, productsController.getByBarcode)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, productsController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateProductDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.create)

  fastify.post("/import", {
    schema: { tags: TAGS, body: toJsonSchema(ImportProductsDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.importMany)

  fastify.post("/bulk-delete", {
    schema: { tags: TAGS, body: toJsonSchema(BulkDeleteProductsDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.deleteMany)

  fastify.delete("/all", {
    schema: { tags: TAGS, querystring: toJsonSchema(DeleteAllProductsQuerySchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.deleteAll)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateProductDtoSchema) },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.update)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard, permissionGuard("catalog_write")],
  }, productsController.delete)
}
