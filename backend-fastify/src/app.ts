import Fastify from "fastify"
import helmet from "@fastify/helmet"
import cors from "@fastify/cors"
import compress from "@fastify/compress"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import { ZodError } from "zod"
import { AppError } from "./core/errors/AppError"
import { env } from "./config/env"
import { getRedisClient } from "./config/redis"
import { routes } from "./presentation/routes"

export const buildApp = async () => {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
      : {
        level: 'info',
      },
  })

  getRedisClient()

  await app.register(helmet)

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:1420", "http://192.168.0.10:1420", 'http://tauri.localhost'],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
  })

  await app.register(compress, { threshold: 1024 })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute"
  })

  await app.register(cookie)

  // ─── Swagger / OpenAPI ───
  await app.register(swagger, {
    openapi: {
      info: {
        title: "POS System API",
        description: "API REST para sistema de punto de venta (POS). Gestión de productos, inventario, ventas, servicios, usuarios y reportes.",
        version: "1.0.0",
      },
      servers: [
        { url: `http://localhost:${env.PORT}/api/v1`, description: "Servidor de desarrollo" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token JWT de acceso (accessToken)",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "accessToken",
            description: "Cookie httpOnly con el accessToken JWT",
          },
        },
      },
      tags: [
        { name: "Auth", description: "Autenticación, registro, verificación de email, recuperación de contraseña" },
        { name: "Products", description: "Gestión de productos (CRUD, búsqueda por código de barra)" },
        { name: "Categories", description: "Categorías de productos" },
        { name: "Services", description: "Servicios compuestos por productos" },
        { name: "Sales", description: "Ventas con productos y servicios, reportes" },
        { name: "Inventory", description: "Movimientos de inventario individuales" },
        { name: "Inventory Batches", description: "Lotes de inventario (entradas/salidas/ajustes masivos)" },
        { name: "Suppliers", description: "Proveedores" },
        { name: "Settings", description: "Configuración del negocio" },
        { name: "Users", description: "Gestión de usuarios del sistema" },
        { name: "Health", description: "Health check del servidor" },
      ],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  })

  // ─── Global error handler ───
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const first = error.errors[0]
      return reply.status(400).send({
        message: first?.message ?? "Datos inválidos"
      })
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message
      })
    }

    // Unknown errors — log and return generic message
    app.log.error(error)
    return reply.status(500).send({
      message: "Error interno del servidor"
    })
  })

  app.register(routes, { prefix: '/api/v1' });

  app.get("/health", {
    schema: { tags: ["Health"] },
  }, async () => {
    return { status: "ok", timestamp: new Date().toISOString() }
  })

  return app
}
