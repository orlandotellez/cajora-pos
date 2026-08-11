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
}
