import type { FastifyReply, FastifyRequest } from "fastify"
import { createClientService } from "../application/client.service"
import { ClientRepository } from "../infrastructure/client.prisma.repository"
import type { UpdateClientData } from "../domain/client.entities"
import { CreateClientDtoSchema, UpdateClientDtoSchema, ClientQuerySchema, ClientPhoneQuerySchema } from "./client.dto"
import { sseBroadcast } from "@/config/sse"

const clientService = createClientService(ClientRepository)

export const clientsController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ClientQuerySchema.parse(request.query)
    const result = await clientService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await clientService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  findByPhone: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ClientPhoneQuerySchema.parse(request.query)
    const result = await clientService.findByPhone(query.phone, request.storeId)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateClientDtoSchema.parse(request.body)
    const result = await clientService.create(data, request.storeId)
    sseBroadcast(request.storeId!, "client.created", { id: result.id })
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateClientDtoSchema.parse(request.body)
    const result = await clientService.update(id, data as UpdateClientData, request.storeId)
    sseBroadcast(request.storeId!, "client.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await clientService.delete(id, request.storeId)
    sseBroadcast(request.storeId!, "client.deleted", { id })
    return reply.status(200).send({ message: "Client deleted successfully" })
  },
}
