import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { notificationController } from "./notification.controller"
import { authGuard } from "@/core/guard/auth.guard"

const TAGS = ["Notifications"]

export const notificationRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS, description: "Listar notificaciones del usuario actual" },
    preHandler: [authGuard],
  }, notificationController.list)

  fastify.get("/unread-count", {
    schema: { tags: TAGS, description: "Conteo de notificaciones no leídas" },
    preHandler: [authGuard],
  }, notificationController.unreadCount)

  fastify.patch("/:id/read", {
    schema: { tags: TAGS, description: "Marcar una notificación como leída" },
    preHandler: [authGuard],
  }, notificationController.markRead)

  fastify.patch("/read-all", {
    schema: { tags: TAGS, description: "Marcar todas las notificaciones como leídas" },
    preHandler: [authGuard],
  }, notificationController.markAllRead)
}
