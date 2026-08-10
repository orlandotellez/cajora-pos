import type { FastifyReply, FastifyRequest } from "fastify"
import { handleSseConnection } from "@/config/sse"

export const eventsController = {
  stream: async (request: FastifyRequest, reply: FastifyReply) => {
    handleSseConnection(request, reply)
  },
}
