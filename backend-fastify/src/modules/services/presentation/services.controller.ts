import type { FastifyReply, FastifyRequest } from "fastify"
import { createServiceService } from "../application/services.service"
import { ServiceRepository } from "../infrastructure/services.prisma.repository"
import { CreateServiceDtoSchema, UpdateServiceDtoSchema, ServiceQuerySchema, BulkDeleteServicesDtoSchema } from "./services.dto"
import { sseBroadcast } from "@/config/sse"

const serviceService = createServiceService(ServiceRepository)

export const servicesController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ServiceQuerySchema.parse(request.query)
    const result = await serviceService.list(query, request.storeId)
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await serviceService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateServiceDtoSchema.parse(request.body)
    const result = await serviceService.create(data, request.storeId)
    sseBroadcast(request.storeId!, "service.created", { id: result.id })
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateServiceDtoSchema.parse(request.body)
    const result = await serviceService.update(id, data, request.storeId)
    sseBroadcast(request.storeId!, "service.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await serviceService.delete(id, request.storeId)
    sseBroadcast(request.storeId!, "service.deleted", { id })
    return reply.status(200).send({ message: "Service deleted successfully" })
  },

  deleteMany: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = BulkDeleteServicesDtoSchema.parse(request.body)
    const result = await serviceService.deleteMany(body.ids, request.storeId)
    if (result.deleted > 0) {
      sseBroadcast(request.storeId!, "service.deleted", { count: result.deleted })
    }
    return reply.status(200).send({ deleted: result.deleted })
  },
}
