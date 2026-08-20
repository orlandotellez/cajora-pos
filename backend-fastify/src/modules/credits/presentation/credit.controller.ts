import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { createCreditService } from "../application/credit.service"
import { CreditRepository } from "../infrastructure/credit.prisma.repository"
import { RegisterPaymentDtoSchema } from "./credit.dto"

const service = createCreditService(CreditRepository)

export async function creditRoutes(fastify: FastifyInstance) {
  // GET /credits — clients with outstanding debt
  fastify.get("/", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const { search, page, limit, filter } = req.query as {
      search?: string
      page?: number
      limit?: number
      filter?: "todos" | "morosos" | "saldados"
    }
    const result = await service.getClientsWithDebt({ search, page, limit, storeId, filter })
    return reply.send(result)
  })

  // GET /credits/total — total pending across all clients
  fastify.get("/total", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const total = await service.getTotalPending(storeId)
    return reply.send({ total })
  })

  // GET /credits/:clientId — client debt detail
  fastify.get("/:clientId", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const { clientId } = req.params as { clientId: string }
    const result = await service.getClientDebt(clientId, storeId)
    return reply.send(result)
  })

  // POST /credits/payments — register a partial payment
  fastify.post("/payments", {
    preHandler: [authGuard, storeGuard],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const storeId = (req as any).storeId as string
    const userId = (req as any).userId as string
    const body = RegisterPaymentDtoSchema.parse(req.body)
    const result = await service.registerPayment(body, userId, storeId)
    return reply.status(201).send(result)
  })
}
