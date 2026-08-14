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
}
