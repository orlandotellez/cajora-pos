import { buildApp } from "./app"
import { env } from "./config/env"
import { setupGracefulShutdown } from "./config/gracefulShutdown"
import { logger } from "./config/logger"

const startServer = async () => {
  try {
    const app = await buildApp()

    setupGracefulShutdown(app)

    await app.listen({ port: env.PORT, host: env.HOST })

    logger.info(`Server listening on http://${env.HOST}:${env.PORT}`)
  } catch (error) {
    logger.error({ err: error }, "Failed to start server")
    process.exit(1)
  }
}

startServer()
