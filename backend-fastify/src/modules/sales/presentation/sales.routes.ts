import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { salesController } from "./sales.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { CreateSaleDtoSchema, SaleQuerySchema, ReportQuerySchema, RevenueTrendQuerySchema, RevenueByHourQuerySchema, RevenueByCategoryQuerySchema } from "./sales.dto"

const TAGS = ["Sales"]

export const salesRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/events", {
    schema: { tags: TAGS, description: "SSE: notifica sale.created en tiempo real" },
    preHandler: [authGuard, storeGuard],
  }, salesController.events)

  fastify.get("/report", {
    schema: { tags: TAGS, querystring: toJsonSchema(ReportQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.report)

  fastify.get("/revenue-trend", {
    schema: { tags: TAGS, querystring: toJsonSchema(RevenueTrendQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.revenueTrend)

  fastify.get("/revenue-by-hour", {
    schema: { tags: TAGS, querystring: toJsonSchema(RevenueByHourQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.revenueByHour)

  fastify.get("/revenue-by-category", {
    schema: { tags: TAGS, querystring: toJsonSchema(RevenueByCategoryQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.revenueByCategory)

  fastify.get("/:id", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, salesController.getById)

  fastify.get("/", {
    schema: { tags: TAGS, querystring: toJsonSchema(SaleQuerySchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.list)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreateSaleDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, salesController.create)
}
