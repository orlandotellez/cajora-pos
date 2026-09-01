import type { FastifyReply, FastifyRequest } from "fastify"
import { createSupplierService } from "../application/suppliers.service"
import { SupplierRepository } from "../infrastructure/suppliers.prisma.repository"
import type { UpdateSupplierData } from "../domain/suppliers.entities"
import { CreateSupplierDtoSchema, UpdateSupplierDtoSchema, SupplierQuerySchema, BulkDeleteSuppliersDtoSchema } from "./suppliers.dto"
import { sseBroadcast } from "@/config/sse"

const supplierService = createSupplierService(SupplierRepository)

export const suppliersController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = SupplierQuerySchema.parse(request.query)
    const result = await supplierService.list({ ...query, storeId: request.storeId })
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await supplierService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateSupplierDtoSchema.parse(request.body)
    const result = await supplierService.create(data, request.storeId)
    sseBroadcast(request.storeId!, "supplier.created", { id: result.id })
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateSupplierDtoSchema.parse(request.body)
    const result = await supplierService.update(id, data as UpdateSupplierData, request.storeId)
    sseBroadcast(request.storeId!, "supplier.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await supplierService.delete(id, request.storeId)
    sseBroadcast(request.storeId!, "supplier.deleted", { id })
    return reply.status(200).send({ message: "Supplier deleted successfully" })
  },

  deleteMany: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = BulkDeleteSuppliersDtoSchema.parse(request.body)
    const result = await supplierService.deleteMany(body.ids, request.storeId)
    if (result.deleted > 0) {
      sseBroadcast(request.storeId!, "supplier.deleted", { count: result.deleted })
    }
    return reply.status(200).send({ deleted: result.deleted })
  },
}
