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
//import { getRedisClient } from "./config/redis"
import { routes } from "./presentation/routes"
import { logger } from "./config/logger"
import { corsOptions } from "./config/cors"
import { swaggerOptions, swaggerUiOptions } from "./config/swagger"

export const buildApp = async () => {
  const app = Fastify({ loggerInstance: logger })

  // comentar hasta que se use
  //getRedisClient()

  await app.register(helmet)

  await app.register(cors, corsOptions)

  await app.register(compress, { threshold: 1024 })

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute"
  })

  await app.register(cookie)

  // ─── Swagger / OpenAPI ───
  if (env.NODE_ENV !== "production") {
    await app.register(swagger, swaggerOptions)
    await app.register(swaggerUi, swaggerUiOptions)
  }
  // ─── Global error handler ───
  app.setErrorHandler(errorHandler)

  app.register(routes, { prefix: '/api/v1' });

  app.get("/api/v1/health", {
    schema: { tags: ["Health"] },
  }, async () => {
    return { status: "ok", timestamp: new Date().toISOString() }
  })

  return app
}
