import { eventsRoutes } from "@/modules/events/presentation/events.routes";
import { authRoutes } from "@/modules/auth/presentation/auth.routes";
import { productsRoutes } from "@/modules/products/presentation/products.routes";
import { categoriesRoutes } from "@/modules/categories/presentation/categories.routes";
import { salesRoutes } from "@/modules/sales/presentation/sales.routes";
import { inventoryRoutes } from "@/modules/inventory/presentation/inventory.routes";
import { batchInventoryRoutes } from "@/modules/batch-inventory/presentation/batch-inventory.routes";
import { suppliersRoutes } from "@/modules/suppliers/presentation/suppliers.routes";
import { servicesRoutes } from "@/modules/services/presentation/services.routes";
import { settingsRoutes } from "@/modules/settings/presentation/settings.routes";
import { usersRoutes } from "@/modules/users/presentation/users.routes";
import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { printersRoutes } from "@/modules/printers/presentation/printers.router";

export const routes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  // Endpoint SSE genérico: `GET /api/v1/events` (sin prefix para que la ruta
  // quede exactamente `/events`, como la usa el frontend).
  fastify.register(eventsRoutes, { prefix: "" })
  fastify.register(authRoutes, { prefix: "/auth" })
  fastify.register(productsRoutes, { prefix: "/products" })
  fastify.register(categoriesRoutes, { prefix: "/categories" })
  fastify.register(servicesRoutes, { prefix: "/services" })
  fastify.register(salesRoutes, { prefix: "/sales" })
  fastify.register(inventoryRoutes, { prefix: "/inventory" })
  fastify.register(batchInventoryRoutes, { prefix: "/inventory/batches" })
  fastify.register(suppliersRoutes, { prefix: "/suppliers" })
  fastify.register(settingsRoutes, { prefix: "/settings" })
  fastify.register(printersRoutes, { prefix: "/printers" })
  fastify.register(usersRoutes, { prefix: "/users" })
}
