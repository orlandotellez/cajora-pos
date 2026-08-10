import { buildApp } from "./app"
import { env } from "./config/env"
import { closeRedis } from "./config/redis"
import { closeSseRedis } from "./config/sse"
import { prisma } from "./config/prisma"

const startServer = async () => {
  try {
    const app = await buildApp()

    await app.listen({ port: env.PORT, host: env.HOST })

    console.log(`Server listening on http://${env.HOST}:${env.PORT}`)

    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`)
      await app.close()
      await prisma.$disconnect()
      await closeSseRedis()
      await closeRedis()
      process.exit(0)
    }

    process.on("SIGINT", () => gracefulShutdown("SIGINT"))
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
