import type { FastifyReply, FastifyRequest } from "fastify"
import type { Role } from "@/types/auth"
import { UnauthorizedError, ForbiddenError } from "@/core/errors/AppError"
import { getUserIdFromCookies, getUserIdFromBearerToken } from "../utils/auth.utils"

declare module "fastify" {
  interface FastifyRequest {
    userId?: string
    userRole?: Role
    storeId?: string
    storeName?: string
  }
}

export const authGuard = async (
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  const fromCookies = getUserIdFromCookies(request)
  const fromBearer = getUserIdFromBearerToken(request)

  const { userId, role, storeId, storeName } = fromCookies.userId ? fromCookies : fromBearer

  if (!userId) {
    throw new UnauthorizedError("Authentication required")
  }

  request.userId = userId
  request.userRole = role ?? undefined
  request.storeId = storeId ?? undefined
  request.storeName = storeName ?? undefined
}

export const adminGuard = async (
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  if (request.userRole !== "admin") {
    throw new ForbiddenError("Admin access required")
  }
}

/**
 * superAdminGuard middleware
 *
 * Restringe rutas globales (cross-tenant) al rol super_admin.
 * Debe correr DESPUÉS de authGuard. NO usa storeGuard: estas
 * rutas agregan datos de TODAS las tiendas.
 */
export const superAdminGuard = async (
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  if (request.userRole !== "super_admin") {
    throw new ForbiddenError("Super admin access required")
  }
}
