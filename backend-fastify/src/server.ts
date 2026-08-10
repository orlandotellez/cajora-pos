import { buildApp } from "./app"
import { env } from "./config/env"
import { closeRedis } from "./config/redis"
import { closeAllSseConnections, closeSseRedis } from "./config/sse"
import { prisma } from "./config/prisma"

const startServer = async () => {
  try {
    const app = await buildApp()

    await app.listen({ port: env.PORT, host: env.HOST })

    console.log(`Server listening on http://${env.HOST}:${env.PORT}`)

    let shuttingDown = false

    const gracefulShutdown = async (signal: string) => {
      // Ctrl+C en pnpm/tsx puede entregar SIGINT más de una vez: la segunda
      // llegada no debe re-ejecutar el shutdown ni imprimir de nuevo.
      if (shuttingDown) return
      shuttingDown = true
      console.log(`Received ${signal}, shutting down gracefully...`)

      // Cinturón y tirantes: si algo del shutdown se cuelga (p. ej. un socket
      // remoto que no responde), salir igual en vez de que tsx haga force-kill
      // a los 5s con un "ELIFECYCLE Command failed".
      const forceExit = setTimeout(() => {
        console.warn("Shutdown excedió 3s, forzando salida")
        process.exit(0)
      }, 3_000)
      forceExit.unref()

      try {
        // Cerrar los sockets SSE ANTES de app.close(): Fastify espera a que
        // los sockets abiertos terminen, y una conexión SSE (hijacked) nunca
        // termina sola — eso cuelga el shutdown con el frontend abierto.
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
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
