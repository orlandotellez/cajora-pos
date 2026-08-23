import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { superAdminController } from "./super-admin.controller"
import { authGuard, superAdminGuard } from "@/core/guard/auth.guard"

const TAGS = ["Super Admin"]

export const superAdminRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  // Estadísticas globales (todas las tiendas).
  fastify.get("/stats", {
    schema: { tags: TAGS },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.stats)

  // Lista de todas las tiendas con métricas agregadas.
  fastify.get("/stores", {
    schema: { tags: TAGS },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.stores)

  // Usuarios de una tienda específica.
  fastify.get("/stores/:id/users", {
    schema: { tags: TAGS },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.storeUsers)

  // Auditoría del ciclo de vida de las suscripciones (quién hizo qué, cuándo).
  fastify.get("/subscription-events", {
    schema: { tags: TAGS, description: "Auditoría: acciones de suscripción (usuario, tienda, webhooks) con filtros" },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.subscriptionEvents)

  // Salud de suscripciones: resumen por estado + tiendas problemáticas + eventos fallidos recientes.
  fastify.get("/subscription-health", {
    schema: { tags: TAGS, description: "Salud global de suscripciones: resumen, tiendas con problemas y eventos fallidos recientes" },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.subscriptionHealth)

  // Lista completa de suscripciones con filtros.
  fastify.get("/subscriptions-list", {
    schema: { tags: TAGS, description: "Lista de todas las suscripciones con estado, tienda, owner" },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.subscriptionsList)

  // Cambiar estado de una suscripción desde el panel super admin.
  fastify.patch("/subscriptions/:storeId/status", {
    schema: { tags: TAGS, description: "Cambiar estado de la suscripción de una tienda" },
    preHandler: [authGuard, superAdminGuard],
  }, superAdminController.updateSubscriptionStatus)
}
