import type { FastifyReply, FastifyRequest } from "fastify"
import { createUserService } from "../application/users.service"
import { UserRepository } from "../infrastructure/users.prisma.repository"
import { CreateUserDtoSchema, UpdateUserDtoSchema, ToggleActiveDtoSchema, UserQuerySchema, BulkDeleteUsersDtoSchema } from "./users.dto"
import { BadRequestError } from "@/core/errors/AppError"
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
      throw new BadRequestError("You cannot delete your own account")
    }

    await userService.delete(id)
    sseBroadcast(request.storeId!, "user.deleted", { id })
    return reply.status(200).send({ message: "User deleted successfully" })
  },

  deleteMany: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = BulkDeleteUsersDtoSchema.parse(request.body)
    const currentUserId = request.userId
    const idsToDelete = body.ids.filter((id) => id !== currentUserId)
    if (idsToDelete.length === 0) {
      return reply.status(200).send({ deleted: 0 })
    }
    const result = await userService.deleteMany(idsToDelete)
    if (result.deleted > 0) {
      sseBroadcast(request.storeId!, "user.deleted", { count: result.deleted })
    }
    return reply.status(200).send({ deleted: result.deleted })
  },

  toggleActive: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const { is_active } = ToggleActiveDtoSchema.parse(request.body)
    const result = await userService.toggleActive(id, is_active)
    sseBroadcast(request.storeId!, "user.updated", { id })
    return reply.status(200).send(result)
  },
}
