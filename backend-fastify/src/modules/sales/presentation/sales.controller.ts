import type { FastifyReply, FastifyRequest } from "fastify"
import { createSaleService } from "../application/sales.service"
import { SaleRepository } from "../infrastructure/sales.prisma.repository"
import { CreateSaleDtoSchema, SaleQuerySchema, ReportQuerySchema, RevenueTrendQuerySchema } from "./sales.dto"
import { UnauthorizedError } from "@/core/errors/AppError"
import { sseBroadcast, sseSubscribe, sseUnsubscribe } from "@/config/sse"
import { isOriginAllowed } from "@/config/cors"

const saleService = createSaleService(SaleRepository)

export const salesController = {
  events: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId!
    const origin = request.headers.origin
    const raw = reply.raw

    reply.hijack()
    raw.setHeader("Content-Type", "text/event-stream")
    raw.setHeader("Cache-Control", "no-cache")
    raw.setHeader("Connection", "keep-alive")
    raw.setHeader("X-Accel-Buffering", "no")
    if (origin && isOriginAllowed(origin)) {
      raw.setHeader("Access-Control-Allow-Origin", origin)
      raw.setHeader("Access-Control-Allow-Credentials", "true")
      raw.setHeader("Vary", "Origin")
    }
    raw.on("error", () => { })
    raw.flushHeaders()
    raw.write(": connected\n\n")

    sseSubscribe(storeId, raw)

    const heartbeat = setInterval(() => {
      if (raw.destroyed || raw.writableEnded) {
        clearInterval(heartbeat)
        return
      }
      raw.write(": ping\n\n")
    }, 25_000)

    request.raw.on("close", () => {
      clearInterval(heartbeat)
      sseUnsubscribe(storeId, raw)
    })
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId
    const storeId = request.storeId
    if (!userId) throw new UnauthorizedError("Authentication required")

    const data = CreateSaleDtoSchema.parse(request.body)
    const result = await saleService.create({ ...data, user_id: userId }, storeId!)

    sseBroadcast(storeId!, "sale.created", {
      id: result.id,
      total: result.total,
      user_name: result.user_name,
      created_at: result.created_at,
    })

    return reply.status(201).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const storeId = request.storeId
    const result = await saleService.getById(id, storeId!)
    return reply.status(200).send(result)
  },

  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = SaleQuerySchema.parse(request.query)
    const result = await saleService.list({ ...query, storeId })
    return reply.status(200).send(result)
  },

  report: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = ReportQuerySchema.parse(request.query)
    const result = await saleService.getReport({ ...query, storeId })
    return reply.status(200).send(result)
  },

  revenueTrend: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = RevenueTrendQuerySchema.parse(request.query)
    const result = await saleService.getRevenueTrend({ ...query, store_id: storeId! })
    return reply.status(200).send(result)
  },
}
