import type { FastifyReply, FastifyRequest } from "fastify"
import { PaymentRequiredError } from "@/core/errors/AppError"
import { getAuthResultFromRequest } from "@/modules/auth/application/common/auth.utils"
import type { IUserRepository } from "@/modules/users/domain/users.interface"

/**
 * Verifica que el usuario autenticado esté activo (is_active = true).
 *
 * Si el owner/admin desactiva un usuario mientras tiene sesión abierta,
 * este guard responde 402 → el frontend abre el paywall de suscripción.
 */
export const createActiveUserGuard = (deps: {
  userRepo: Pick<IUserRepository, "findById">
}) => {
  const { userRepo } = deps

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const { userId } = getAuthResultFromRequest(request, { prefer: "storeId" })

    if (!userId) return

    const user = await userRepo.findById(userId)

    if (user && !user.is_active) {
      throw new PaymentRequiredError(
        "Tu usuario está desactivado. Contacta al administrador de la tienda."
      )
    }
  }
}