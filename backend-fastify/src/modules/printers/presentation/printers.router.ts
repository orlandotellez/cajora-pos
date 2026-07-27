import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { printersController } from "./printers.controller"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import {
  CreatePrinterDtoSchema,
  UpdatePrinterDtoSchema,
  SetDefaultPrinterDtoSchema,
  TestPrintDtoSchema,
  PrinterIdParamSchema,
} from "./printers.dto"

const TAGS = ["Printers"]

export const printersRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/", {
    schema: { tags: TAGS },
    preHandler: [authGuard, storeGuard],
  }, printersController.list)

  fastify.post("/", {
    schema: { tags: TAGS, body: toJsonSchema(CreatePrinterDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, printersController.create)

  fastify.post("/:id/test", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
      body: toJsonSchema(TestPrintDtoSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.testPrint)

  fastify.post("/:id/probe", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.probePrint)

  fastify.post("/:id/set-default", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
      body: toJsonSchema(SetDefaultPrinterDtoSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.setAsDefault)

  fastify.get("/:id", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.getById)

  fastify.patch("/:id", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
      body: toJsonSchema(UpdatePrinterDtoSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.update)

  fastify.delete("/:id", {
    schema: {
      tags: TAGS,
      params: toJsonSchema(PrinterIdParamSchema),
    },
    preHandler: [authGuard, storeGuard],
  }, printersController.delete)
}
