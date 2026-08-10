import type { FastifyReply, FastifyRequest } from "fastify"
import { createUserService } from "../application/users.service"
import { UserRepository } from "../infrastructure/users.prisma.repository"
import { CreateUserDtoSchema, UpdateUserDtoSchema, UserQuerySchema } from "./users.dto"
import { sseBroadcast } from "@/config/sse"

const userService = createUserService(UserRepository)

export const usersController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = UserQuerySchema.parse(request.query)
    const result = await userService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await userService.getById(id)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateUserDtoSchema.parse(request.body)
    const result = await userService.create({ ...data, store_id: request.storeId }, request.storeId)
    sseBroadcast(request.storeId!, "user.created", { id: result.id })
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateUserDtoSchema.parse(request.body)
    const result = await userService.update(id, data, request.storeId)
    sseBroadcast(request.storeId!, "user.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const currentUserId = request.userId

    if (id === currentUserId) {
      return reply.status(400).send({ message: "You cannot delete your own account" })
    }

    await userService.delete(id)
    sseBroadcast(request.storeId!, "user.deleted", { id })
    return reply.status(200).send({ message: "User deleted successfully" })
  },
}
