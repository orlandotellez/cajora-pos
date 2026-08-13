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
import { superAdminRoutes } from "@/modules/super-admin/presentation/super-admin.routes";
import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { printersRoutes } from "@/modules/printers/presentation/printers.router";
import { subscriptionRoutes } from "@/modules/subscriptions/presentation/subscription.routes";
import { webhookRoutes } from "@/modules/subscriptions/presentation/webhook.routes";
import { licenseGuard } from "@/core/guard/license.guard";

export const routes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.register(eventsRoutes, { prefix: "" })
  fastify.register(authRoutes, { prefix: "/auth" })

  fastify.register(async (business) => {
    business.addHook("preHandler", licenseGuard)
    business.register(productsRoutes, { prefix: "/products" })
    business.register(categoriesRoutes, { prefix: "/categories" })
    business.register(servicesRoutes, { prefix: "/services" })
    business.register(salesRoutes, { prefix: "/sales" })
    business.register(inventoryRoutes, { prefix: "/inventory" })
    business.register(batchInventoryRoutes, { prefix: "/inventory/batches" })
    business.register(suppliersRoutes, { prefix: "/suppliers" })
    business.register(settingsRoutes, { prefix: "/settings" })
    business.register(printersRoutes, { prefix: "/printers" })
    business.register(usersRoutes, { prefix: "/users" })
  })

  fastify.register(superAdminRoutes, { prefix: "/super-admin" })
  fastify.register(subscriptionRoutes, { prefix: "/subscriptions" })
  fastify.register(webhookRoutes, { prefix: "/webhooks/paypal" })
}
