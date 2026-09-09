import Fastify from "fastify"
import helmet from "@fastify/helmet"
import cors from "@fastify/cors"
import compress from "@fastify/compress"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import { errorHandler } from "./config/error-handler"
import { env } from "./config/env"
import "./config/redis"
import { logger } from "./config/logger"
import { corsOptions } from "./config/cors"
import { swaggerOptions, swaggerUiOptions } from "./config/swagger"
import { routes } from "./http/routes"
import { reconciliationSchedulerPlugin } from "./modules/subscriptions/infrastructure/reconciliation.scheduler"
import { getUserIdFromBearerToken, getUserIdFromCookies } from "./modules/auth/application/common/auth.utils"
import { createLicenseGuard } from "./core/guard/license.guard"
import { createActiveUserGuard } from "./core/guard/active-user.guard"
import { createPermissionGuard } from "./core/guard/permission.guard"
import { SubscriptionRepository } from "./modules/subscriptions/infrastructure/subscription.prisma.repository"
import { UserRepository } from "./modules/users/infrastructure/users.prisma.repository"

export const buildApp = async () => {
  const app = Fastify({ loggerInstance: logger, trustProxy: true })

  await app.register(helmet)

  await app.register(cors, corsOptions)

  await app.register(compress, { threshold: 1024 })

  await app.register(cookie)

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      try {
        const fromCookies = getUserIdFromCookies(request)
        const fromBearer = getUserIdFromBearerToken(request)
        const { userId } = fromCookies.userId ? fromCookies : fromBearer
        if (userId) return userId
      } catch { }
      return request.ip
    },
  })

  // ─── Swagger / OpenAPI ───
  if (env.NODE_ENV !== "production") {
    await app.register(swagger, swaggerOptions)
    await app.register(swaggerUi, swaggerUiOptions)
  }
  // ─── Global error handler ───
  app.setErrorHandler(errorHandler)

  // ─── Guards (composition root: instancias construidas con repos reales) ───
  app.decorate("licenseGuard", createLicenseGuard({ subscriptionRepo: SubscriptionRepository }))
  app.decorate("activeUserGuard", createActiveUserGuard({ userRepo: UserRepository }))
  app.decorate("permissionGuard", createPermissionGuard({ userRepo: UserRepository }))

  app.register(routes, { prefix: '/api/v1' });

  app.get("/api/v1/health", {
    schema: { tags: ["Health"] },
  }, async () => {
    return { status: "ok", timestamp: new Date().toISOString() }
  })

  // Job de reconciliación de suscripciones vs PayPal (scheduler zero-dep)
  await app.register(reconciliationSchedulerPlugin)

  return app
}
