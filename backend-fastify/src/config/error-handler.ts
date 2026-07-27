import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../core/errors/AppError";

export const errorHandler = (
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof ZodError) {
    const first = error.errors[0];
    return reply.status(400).send({
      message: first?.message ?? "Datos inválidos",
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
    });
  }

  // Unknown errors — log and return generic message
  request.log.error(error);
  return reply.status(500).send({
    message: "Error interno del servidor",
  });
};
