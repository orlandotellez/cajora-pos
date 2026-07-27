import { FastifyReply, FastifyRequest } from "fastify";
import { createPrintersService } from "../application/printers.service";
import { PrinterRepository } from "../infrastructure/printers.prisma.repository";
import { CreatePrinterDtoSchema, PrinterIdParamSchema, PrintReceiptDtoSchema, SetDefaultPrinterDtoSchema, SendTcpDtoSchema, TestPrintDtoSchema, UpdatePrinterDtoSchema } from "./printers.dto";

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

    return reply.status(200).send({
      message: "Ticket de prueba generado correctamente",
      ...result,
    })
  },

  probePrint: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)

    const result = await printersService.probePrint(id, request.storeId as string)

    return reply.status(200).send({
      message: "Probe generado. Enviá el ticket desde el dispositivo para identificar la codepage correcta.",
      ...result,
    })
  },

  sendTcp: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = SendTcpDtoSchema.parse(request.body)

    const result = await printersService.sendTcp(body.ticket_base64, body.address, body.port)

    if (!result.success) {
      return reply.status(502).send({
        message: "No se pudo conectar con la impresora desde el servidor",
        ...result,
      })
    }

    return reply.status(200).send({
      message: "Datos enviados a la impresora correctamente",
      ...result,
    })
  },

  printReceipt: async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = PrinterIdParamSchema.parse(request.params)
    const { sale_id, copies, currency } = PrintReceiptDtoSchema.parse(request.body)

    const result = await printersService.printReceipt(id, request.storeId as string, sale_id, copies, currency)

    return reply.status(200).send({
      message: "Ticket generado correctamente",
      ...result,
    })
  }
}
