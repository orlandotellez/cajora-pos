import type { FastifyReply, FastifyRequest } from "fastify"
import { createSaleService } from "../application/sales.service"
import { SaleRepository } from "../infrastructure/sales.prisma.repository"
import { CreateSaleDtoSchema, SaleQuerySchema, ReportQuerySchema, RevenueTrendQuerySchema, RevenueByHourQuerySchema, RevenueByCategoryQuerySchema, ProductPerformanceQuerySchema } from "./sales.dto"
import { UnauthorizedError } from "@/core/errors/AppError"
import { handleSseConnection, sseBroadcast } from "@/config/sse"

const saleService = createSaleService(SaleRepository)

export const salesController = {
  events: async (request: FastifyRequest, reply: FastifyReply) => {
    handleSseConnection(request, reply)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId
    const storeId = request.storeId
    if (!userId) throw new UnauthorizedError("Authentication required")

    const data = CreateSaleDtoSchema.parse(request.body)
    const result = await saleService.create({ ...data, user_id: userId }, storeId!)

    const soldProductIds = [
      ...(result.items ?? []).map((i) => i.product_id),
      ...(result.service_items ?? []).flatMap((si) => si.products?.map((sp) => sp.product_id) ?? []),
    ]
    sseBroadcast(storeId!, "sale.created", {
      id: result.id,
      total: result.total,
      user_name: result.user_name,
      created_at: result.created_at,
      product_ids: Array.from(new Set(soldProductIds)),
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

  revenueByHour: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = RevenueByHourQuerySchema.parse(request.query)
    const result = await saleService.getRevenueByHour({ ...query, store_id: storeId! })
    return reply.status(200).send(result)
  },

  revenueByCategory: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = RevenueByCategoryQuerySchema.parse(request.query)
    const result = await saleService.getRevenueByCategory({ ...query, store_id: storeId! })
    return reply.status(200).send(result)
  },

  productPerformance: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    const query = ProductPerformanceQuerySchema.parse(request.query)
    const result = await saleService.getProductPerformance({ ...query, store_id: storeId! })
    return reply.status(200).send(result)
  },
}
