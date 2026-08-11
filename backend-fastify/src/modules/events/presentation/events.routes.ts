import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { eventsController } from "./events.controller"
import { authGuard } from "@/core/guard/auth.guard"

const TAGS = ["Realtime"]

export const eventsRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  // Solo auth: el super admin (sin tienda) también puede conectar; el hub SSE
  // simplemente no lo suscribe a ningún canal de tienda (no recibe eventos).
  fastify.get("/events", {
    schema: { tags: TAGS, description: "SSE: stream de eventos de la tienda en tiempo real" },
    preHandler: [authGuard],
  }, eventsController.stream)
}
