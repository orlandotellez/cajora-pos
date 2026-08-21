import type { FastifyReply, FastifyRequest } from "fastify"
import { prisma } from "@/config/prisma"
import { ForbiddenError } from "@/core/errors/AppError"

/**
 * permissionGuard - Factory that returns a preHandler middleware.
 *
 * Checks if the authenticated user has at least one of the required permissions.
 * Must run AFTER authGuard (which sets request.userId).
 *
 * @param requiredPermissions - One or more permission strings. The user needs at least one.
 */
export function permissionGuard(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // Admins always have all permissions
    if (request.userRole === "admin" || request.userRole === "super_admin") {
      return
    }

    const userId = request.userId
    if (!userId) {
      throw new ForbiddenError("User not authenticated")
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { permissions: true },
    })

    const userPermissions: string[] =
      user?.permissions && Array.isArray(user.permissions)
        ? (user.permissions as string[])
        : []

    const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p))

    if (!hasPermission) {
      throw new ForbiddenError(
        `Se requiere uno de los siguientes permisos: ${requiredPermissions.join(", ")}`,
      )
    }
  }
}
