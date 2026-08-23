import type { FastifyReply, FastifyRequest } from "fastify"
import { superAdminService } from "../application/super-admin.service"

export const superAdminController = {
  stats: async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await superAdminService.getStats()
    return reply.status(200).send(result)
  },

  stores: async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await superAdminService.getStores()
    return reply.status(200).send(result)
  },

  storeUsers: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await superAdminService.getStoreUsers(id)
    return reply.status(200).send(result)
  },

  subscriptionEvents: async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string | undefined>
    const limit = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200)
    const offset = Math.max(Number(q.offset ?? 0) || 0, 0)
    const result = await superAdminService.getSubscriptionEvents({
      store_id: q.store_id,
      user_id: q.user_id,
      action: q.action,
      from: q.from,
      to: q.to,
      limit,
      offset,
    })
    return reply.status(200).send(result)
  },

  subscriptionHealth: async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await superAdminService.getSubscriptionHealth()
    return reply.status(200).send(result)
  },

  subscriptionsList: async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string | undefined>
    const limit = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200)
    const offset = Math.max(Number(q.offset ?? 0) || 0, 0)
    const result = await superAdminService.getSubscriptionsList({
      status: q.status,
      mode: q.mode,
      search: q.search,
      limit,
      offset,
    })
    return reply.status(200).send(result)
  },

  updateSubscriptionStatus: async (request: FastifyRequest, reply: FastifyReply) => {
    const { storeId } = request.params as { storeId: string }
    const { status } = request.body as { status: string }
    const validStatuses = ["active", "past_due", "canceled", "expired", "pending"]
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: `Estado inválido. Permitidos: ${validStatuses.join(", ")}` })
    }
    const result = await superAdminService.updateSubscriptionStatus(storeId, status)
    if (!result) {
      return reply.status(404).send({ error: "Suscripción no encontrada" })
    }
    return reply.status(200).send(result)
  },
}
