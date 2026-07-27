import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { settingsController } from "./settings.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { UpdateSettingsDtoSchema } from "./settings.dto"

const TAGS = ["Settings"]

export const settingsRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, settingsController.get)

  fastify.put("/", {
    schema: { tags: TAGS, body: toJsonSchema(UpdateSettingsDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, settingsController.update)
}
