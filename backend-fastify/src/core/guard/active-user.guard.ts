import type { FastifyReply, FastifyRequest } from "fastify"
import { ForbiddenError, PaymentRequiredError } from "@/core/errors/AppError"
import { getAuthResultFromRequest } from "@/modules/auth/application/common/auth.utils"
import type { IUserRepository } from "@/modules/users/domain/users.interface"
import { evaluateUserAccess } from "@/modules/users/domain/user-access"

/**
 * Verifica que el usuario autenticado tenga acceso.
 *
 * Hay dos switches independientes:
 *
 * - `is_active` (false) — lo maneja el dueño/admin de la tienda desde su panel.
 *   Responde 402 y el frontend abre el paywall de suscripción.
 * - `access_status` (restricted) — lo maneja el super admin desde el panel de
 *   plataforma y el dueño de la tienda NO puede revertirlo. Responde 403: no es
 *   un problema de pago, así que mostrar el paywall sería engañoso (el usuario
 *   podría pagar y seguir bloqueado).
 *
 * Si el owner/admin desactiva un usuario mientras tiene sesión abierta, o si el
 * super admin lo restringe, el guard corta en la siguiente request.
 */
export const createActiveUserGuard = (deps: {
  userRepo: Pick<IUserRepository, "findById">
}) => {
  const { userRepo } = deps

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const { userId } = getAuthResultFromRequest(request, { prefer: "storeId" })

    if (!userId) return

    const user = await userRepo.findById(userId)
    if (!user) return

    // La política vive en evaluateUserAccess para que el guard, el login y el
    // refresh no puedan divergir.
    const access = evaluateUserAccess(user)

    if (access === "restricted") {
      throw new ForbiddenError(
        "Tu acceso está restringido por el administrador de la plataforma.",
        "USER_ACCESS_RESTRICTED",
      )
    }

    if (access === "inactive") {
      throw new PaymentRequiredError(
        "Tu usuario está desactivado. Contacta al administrador de la tienda."
      )
    }
  }
}