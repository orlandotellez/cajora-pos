import type { FastifyReply, FastifyRequest } from "fastify"
import { ForbiddenError } from "@/core/errors/AppError"

/**
 * storeGuard middleware
 *
 * Ensures that the authenticated request has a store context.
 * This MUST run AFTER authGuard, which sets request.storeId.
 *
 * Attach to routes that require store-scoped data access.
 * All business data routes (products, sales, inventory, etc.) should use this.
 */
export const storeGuard = async (
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  if (!request.storeId) {
    throw new ForbiddenError("Store context required. Please login again.", "STORE_CONTEXT_REQUIRED")
  }
}