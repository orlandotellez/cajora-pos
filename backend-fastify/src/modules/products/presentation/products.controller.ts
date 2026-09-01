import type { FastifyReply, FastifyRequest } from "fastify"
import { createProductService } from "../application/products.service"
import { ProductRepository } from "../infrastructure/products.prisma.repository"
import type { UpdateProductData } from "../domain/products.entities"
import { CreateProductDtoSchema, UpdateProductDtoSchema, ProductQuerySchema, ImportProductsDtoSchema, ImportProductRowSchema, BulkDeleteProductsDtoSchema, DeleteAllProductsQuerySchema, type ImportProductRowDto } from "./products.dto"
import { BadRequestError, NotFoundError } from "@/core/errors/AppError"
import { sseBroadcast } from "@/config/sse"

const productService = createProductService(ProductRepository)

export const productsController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ProductQuerySchema.parse(request.query)
    const result = await productService.list({
      search: query.search,
      category_id: query.category_id,
      unitType: query.unit_type,
      active: query.active,
      lowStock: query.low_stock,
      outOfStock: query.out_of_stock,
      page: query.page,
      limit: query.limit,
      storeId: request.storeId,
    })
    return reply.status(200).send(result)
  },

  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const result = await productService.getById(id, request.storeId)
    return reply.status(200).send(result)
  },

  getByBarcode: async (request: FastifyRequest, reply: FastifyReply) => {
    const { barcode } = request.params as { barcode: string }
    const result = await productService.getByBarcode(barcode, request.storeId)
    if (!result) {
      throw new NotFoundError("Product not found")
    }
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateProductDtoSchema.parse(request.body)
    const result = await productService.create(data, request.storeId)
    sseBroadcast(request.storeId!, "product.created", { id: result.id })
    return reply.status(201).send(result)
  },

  importMany: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ImportProductsDtoSchema.parse(request.body)
    const rows = body.rows as unknown[]

    const errors: { row: number; message: string }[] = []
    const validRows: ImportProductRowDto[] = []
    for (let i = 0; i < rows.length; i++) {
      const result = ImportProductRowSchema.safeParse(rows[i])
      if (!result.success) {
        errors.push({ row: i + 1, message: result.error.issues.map((x) => x.message).join("; ") })
        continue
      }
      validRows.push(result.data)
    }

    const biz = await productService.importMany(validRows, request.storeId!)
    if (biz.imported > 0) {
      sseBroadcast(request.storeId!, "product.created", { imported: biz.imported })
    }
    return reply.status(200).send({ imported: biz.imported, errors: [...errors, ...biz.errors] })
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const data = UpdateProductDtoSchema.parse(request.body)
    const result = await productService.update(id, data as UpdateProductData, request.storeId)
    sseBroadcast(request.storeId!, "product.updated", { id })
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await productService.delete(id, request.storeId)
    sseBroadcast(request.storeId!, "product.deleted", { id })
    return reply.status(200).send({ message: "Product deleted successfully" })
  },

  deleteMany: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = BulkDeleteProductsDtoSchema.parse(request.body)
    const result = await productService.deleteMany(body.ids, request.storeId)
    if (result.deleted > 0) {
      sseBroadcast(request.storeId!, "product.deleted", { count: result.deleted })
    }
    return reply.status(200).send({ deleted: result.deleted })
  },

  deleteAll: async (request: FastifyRequest, reply: FastifyReply) => {
    const query = DeleteAllProductsQuerySchema.parse(request.query)
    const result = await productService.deleteAllByFilters({
      search: query.search,
      category_id: query.category_id,
      active: query.active,
      lowStock: query.low_stock,
      outOfStock: query.out_of_stock,
      storeId: request.storeId,
    })
    if (result.deleted > 0) {
      sseBroadcast(request.storeId!, "product.deleted", { count: result.deleted })
    }
    return reply.status(200).send({ deleted: result.deleted })
  },
}
