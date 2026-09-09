import { buildApp } from "./app"
import { env } from "./config/env"
import { setupGracefulShutdown } from "./config/gracefulShutdown"

const startServer = async () => {
  try {
    const app = await buildApp()

    setupGracefulShutdown(app)

    await app.listen({ port: env.PORT, host: env.HOST })

    console.log(`Server listening on http://${env.HOST}:${env.PORT}`)
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
