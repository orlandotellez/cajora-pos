import type { FastifyReply, FastifyRequest } from "fastify"
import { createCategoryService } from "../application/categories.service"
import { CategoryRepository } from "../infrastructure/categories.prisma.repository"
import type { UpdateCategoryData } from "../domain/categories.entities"
import { CreateCategoryDtoSchema, UpdateCategoryDtoSchema, CategoryQuerySchema } from "./categories.dto"
import { sseBroadcast } from "@/config/sse"

const categoryService = createCategoryService(CategoryRepository)

export const categoriesController = {
  listSimple: async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = await CategoryRepository.findAll({ storeId: request.storeId, limit: 100 })
    return reply.status(200).send(
      categories.categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
      })),
    )
  },

  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = CategoryQuerySchema.parse(request.query)
    const result = await categoryService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await categoryService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateCategoryDtoSchema.parse(request.body)
    const result = await categoryService.create(data, request.storeId)
    sseBroadcast(request.storeId!, "category.created", { id: result.id })
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateCategoryDtoSchema.parse(request.body)
    const result = await categoryService.update(id, data as UpdateCategoryData, request.storeId)
    sseBroadcast(request.storeId!, "category.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await categoryService.delete(id, request.storeId)
    sseBroadcast(request.storeId!, "category.deleted", { id })
    return reply.status(200).send({ message: "Category deleted successfully" })
  },
}
