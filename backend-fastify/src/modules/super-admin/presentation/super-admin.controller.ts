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
}
