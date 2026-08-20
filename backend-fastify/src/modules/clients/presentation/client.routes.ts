import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { clientsController } from "./client.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateClientDtoSchema, UpdateClientDtoSchema, ClientQuerySchema, ClientPhoneQuerySchema } from "./client.dto"

const TAGS = ["Clients"]

export const clientsRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(ClientQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, clientsController.list)

  fastify.get("/by-phone", {
    schema: { tags: TAGS, querystring: toJsonSchema(ClientPhoneQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, clientsController.findByPhone)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, clientsController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateClientDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, clientsController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateClientDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, clientsController.update)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, clientsController.delete)
}
