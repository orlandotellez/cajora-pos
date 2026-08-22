import type { FastifyReply, FastifyRequest } from "fastify"
import { PaymentRequiredError } from "@/core/errors/AppError"
import { getUserIdFromCookies, getUserIdFromBearerToken } from "../utils/auth.utils"
import { prisma } from "@/config/prisma"

/**
 * Verifica que el usuario autenticado esté activo (is_active = true).
 *
 * Si el owner/admin desactiva un usuario mientras tiene sesión abierta,
 * este guard responde 402 → el frontend abre el paywall de suscripción.
 */
export const activeUserGuard = async (
  request: FastifyRequest,
  _reply: FastifyReply
) => {
  const fromCookies = getUserIdFromCookies(request)
  const fromBearer = getUserIdFromBearerToken(request)
  const { userId } = fromCookies.userId ? fromCookies : fromBearer

  if (!userId) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is_active: true },
  })

  if (user && !user.is_active) {
    throw new PaymentRequiredError(
      "Tu usuario está desactivado. Contacta al administrador de la tienda."
    )
  }
}
