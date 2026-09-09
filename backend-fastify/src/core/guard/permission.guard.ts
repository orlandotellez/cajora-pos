import type { FastifyReply, FastifyRequest } from "fastify"
import { ForbiddenError } from "@/core/errors/AppError"
import type { IUserRepository } from "@/modules/users/domain/users.interface"

/**
 * createPermissionGuard - Factory que devuelve un guard factory de permisos.
 *
 * La factory recibe el repositorio de usuarios; el guard resultante se
 * construye con los permisos requeridos y se usa como preHandler.
 *
 * Checks if the authenticated user has at least one of the required permissions.
 * Must run AFTER authGuard (which sets request.userId).
 *
 * @param deps.userRepo - Repositorio con findById (SELECT permissions del usuario).
 */
export function createPermissionGuard(deps: {
  userRepo: Pick<IUserRepository, "findById">
}) {
  const { userRepo } = deps

  return function permissionGuard(...requiredPermissions: string[]) {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      // Admins always have all permissions
      if (request.userRole === "admin" || request.userRole === "super_admin") {
        return
      }

      const userId = request.userId
      if (!userId) {
        throw new ForbiddenError("User not authenticated")
      }

      const user = await userRepo.findById(userId)

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
}