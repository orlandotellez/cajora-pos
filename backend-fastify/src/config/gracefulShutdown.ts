import type { buildApp } from "../app"
import { closeRedis } from "./redis"
import { closeAllSseConnections, closeSseRedis } from "./sse"
import { prisma } from "./prisma"

type AppInstance = Awaited<ReturnType<typeof buildApp>>

export const setupGracefulShutdown = (app: AppInstance) => {
  let shuttingDown = false

  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal}, shutting down gracefully...`)

    const forceExit = setTimeout(() => {
      console.warn("Shutdown excedió 3s, forzando salida")
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
      console.error("Error during graceful shutdown:", error)
      process.exit(1)
    }
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
}
