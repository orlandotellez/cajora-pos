import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { UnauthorizedError } from "@/core/errors/AppError"
import { createCashRegisterService } from "../application/cash-register.service"
import { CashRegisterRepository } from "../infrastructure/cash-register.prisma.repository"
import { OpenCashSessionDtoSchema, CloseCashSessionDtoSchema, CashHistoryQuerySchema } from "./cash-register.dto"

const service = createCashRegisterService(CashRegisterRepository)

export async function cashRegisterRoutes(fastify: FastifyInstance) {
  fastify.post("/open", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string
    const storeId = (req as any).storeId as string
    if (!userId) throw new UnauthorizedError("Authentication required")

    const body = OpenCashSessionDtoSchema.parse(req.body)
    const session = await service.open(body, userId, storeId)
    return reply.status(201).send(session)
  })

  fastify.post("/close", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string
    const userRole = (req as any).userRole as string | undefined
    const storeId = (req as any).storeId as string
    if (!userId) throw new UnauthorizedError("Authentication required")

    const body = CloseCashSessionDtoSchema.parse(req.body)
    const result = await service.close({ ...body, store_id: storeId }, userId, userRole, storeId)
    return reply.send(result)
  })

  fastify.get("/status", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const result = await service.status(storeId)
    return reply.send(result)
  })

  fastify.get("/history", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const query = CashHistoryQuerySchema.parse(req.query ?? {})
    const result = await service.history({ ...query, storeId })
    return reply.send(result)
  })
}
