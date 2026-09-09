import type { buildApp } from "../app"
import { closeRedis } from "./redis"
import { closeAllSseConnections, closeSseRedis } from "./sse"
import { prisma } from "./prisma"
import { logger } from "./logger"

type AppInstance = Awaited<ReturnType<typeof buildApp>>

export const setupGracefulShutdown = (app: AppInstance) => {
  let shuttingDown = false

  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`Received ${signal}, shutting down gracefully...`)

    const forceExit = setTimeout(() => {
      logger.warn("Shutdown excedió 3s, forzando salida")
      process.exit(0)
    }, 3_000)
    forceExit.unref()

    try {
      closeAllSseConnections()
      await app.close()
      await prisma.$disconnect()
      await closeSseRedis()
      await closeRedis()
      clearTimeout(forceExit)
      process.exit(0)
    } catch (error) {
      logger.error({ err: error }, "Error during graceful shutdown")
      process.exit(1)
    }
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
}
