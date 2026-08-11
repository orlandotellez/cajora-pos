import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "@/core/errors/AppError";
import { getCodeForStatus, getErrorMessageForStatus } from "@/core/errors/error-messages";
import { formatAjvValidationMessage, formatZodIssueMessage } from "@/core/errors/validation-messages";

export const errorHandler = (
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // Zod validation errors → 400 con mensaje entendible del primer issue.
  if (error instanceof ZodError) {
    request.log.warn({ err: error }, "Zod validation error");
    return reply.status(400).send({
      code: "BAD_REQUEST",
      message: formatZodIssueMessage(error.issues[0]) ?? getErrorMessageForStatus(400),
    });
  }

  // App errors → status/code propio, message genérico del mapa, original al log.
  if (error instanceof AppError) {
    request.log.warn({ err: error }, `App error (${error.code})`);
    return reply.status(error.statusCode).send({
      code: error.code,
      message: getErrorMessageForStatus(error.statusCode),
    });
  }

  // FST_ERR_VALIDATION → validación AJV del schema de la ruta (Fastify 5).
  // `error.code` solo existe en FastifyError, por eso el narrow con "code" in error.
  if ("code" in error && error.code === "FST_ERR_VALIDATION") {
    const fastifyError = error as FastifyError;
    request.log.warn({ err: error }, "AJV schema validation error");
    const first = Array.isArray(fastifyError.validation) ? fastifyError.validation[0] : undefined;
    return reply.status(400).send({
      code: "BAD_REQUEST",
      message: formatAjvValidationMessage(first) ?? getErrorMessageForStatus(400),
    });
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    request.log.warn({ err: error }, `Fastify error (status ${error.statusCode})`);
    const status = error.statusCode;
    return reply.status(status).send({
      code: getCodeForStatus(status),
      message: getErrorMessageForStatus(status),
    });
  }

  // Unknown errors → 500 genérico + log completo.
  request.log.error({ err: error }, "Unexpected error");
  return reply.status(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: getErrorMessageForStatus(500),
  });
};
