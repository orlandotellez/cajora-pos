import { FastifyReply, FastifyRequest } from "fastify";
import { createPrintersService } from "../application/printers.service";
import { PrinterRepository } from "../infrastructure/printers.prisma.repository";
import { CreatePrinterDtoSchema, PrinterIdParamSchema, SetDefaultPrinterDtoSchema, TestPrintDtoSchema, UpdatePrinterDtoSchema } from "./printers.dto";

const printersService = createPrintersService(PrinterRepository)

export const printersController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await printersService.list(request.storeId as string)
    return reply.status(200).send({ printers: result })
  },
  getById: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    const result = await printersService.getById(id, request.storeId as string)
    return reply.status(200).send(result)
  },

  create: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreatePrinterDtoSchema.parse(request.body)
    const result = await printersService.create(data, request.storeId as string)
    return reply.status(201).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    const data = UpdatePrinterDtoSchema.parse(request.body)
    const result = await printersService.update(id, request.storeId as string, data)
    return reply.status(200).send(result)
  },

  delete: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    await printersService.delete(id, request.storeId as string)
    return reply.status(200).send({ message: "Impresora eliminada correctamente" })
  },

  setAsDefault: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    const { role } = SetDefaultPrinterDtoSchema.parse(request.body)
    const result = await printersService.setAsDefault(id, request.storeId as string, role)
    return reply.status(200).send(result)
  },

  testPrint: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    const body = TestPrintDtoSchema.parse(request.body ?? {})

    const result = await printersService.testPrint(id, request.storeId as string, body.copies)

    if (!result.success) {
      return reply.status(502).send({
        message: "No se pudo conectar con la impresora",
        ...result,
      })
    }

    return reply.status(200).send({
      message: "Ticket de prueba enviado correctamente",
      ...result,
    })
  },

  probePrint: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)

    const result = await printersService.probePrint(id, request.storeId as string)

    if (!result.success) {
      return reply.status(502).send({
        message: "No se pudo conectar con la impresora",
        ...result,
      })
    }

    return reply.status(200).send({
      message: "Probe enviado. En el ticket impreso, identificá la línea donde 'ñ á é í ó ú' se vean correctos.",
      ...result,
    })
  }
}
