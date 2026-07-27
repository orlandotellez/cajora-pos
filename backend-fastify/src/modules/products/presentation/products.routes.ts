import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { productsController } from "./products.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateProductDtoSchema, UpdateProductDtoSchema, ProductQuerySchema } from "./products.dto"

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
    preHandler: [authGuard, storeGuard],
  }, productsController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateProductDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, productsController.update)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, productsController.delete)
}
