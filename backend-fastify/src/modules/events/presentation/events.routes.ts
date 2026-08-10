import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { eventsController } from "./events.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"

const TAGS = ["Realtime"]

export const eventsRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/events", {
    schema: { tags: TAGS, description: "SSE: stream de eventos de la tienda en tiempo real" },
    preHandler: [authGuard, storeGuard],
  }, eventsController.stream)
}
