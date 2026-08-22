import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { usersController } from "./users.controller"
import { authGuard, adminGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateUserDtoSchema, UpdateUserDtoSchema, ToggleActiveDtoSchema, UserQuerySchema } from "./users.dto"

const TAGS = ["Users"]

export const usersRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(UserQuerySchema) },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.list)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.getById)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateUserDtoSchema) },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.create)

  fastify.put("/:id", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateUserDtoSchema) },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.update)

  fastify.delete("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.delete)

  fastify.patch("/:id/active", {
    schema: { tags: TAGS, body: toJsonSchema(ToggleActiveDtoSchema) },
    preHandler: [authGuard, adminGuard, storeGuard],
  }, usersController.toggleActive)
}
