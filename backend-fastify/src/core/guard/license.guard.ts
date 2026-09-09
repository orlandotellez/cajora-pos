import type { FastifyReply, FastifyRequest } from "fastify"
import { env } from "@/config/env"
import { PaymentRequiredError } from "@/core/errors/AppError"
import { getAuthResultFromRequest } from "@/modules/auth/application/common/auth.utils"
import type { ISubscriptionRepository } from "@/modules/subscriptions/domain/subscription.interface"

const GRACE_DAYS = 3
const DAY_MS = 86_400_000

export const createLicenseGuard = (deps: {
  subscriptionRepo: Pick<ISubscriptionRepository, "getByStoreId">
}) => {
  const { subscriptionRepo } = deps

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (env.APP_MODE !== "cloud") return

    const { storeId } = getAuthResultFromRequest(request, { prefer: "storeId" })

    if (!storeId) return

    const sub = await subscriptionRepo.getByStoreId(storeId)

    if (!sub) {
      throw new PaymentRequiredError(
        "Plan Cloud requiere suscripción. Elige tu plan para continuar."
      )
    }

    if (sub.status === "active") return

    if (sub.status === "pending") {
      throw new PaymentRequiredError(
        "Plan Cloud requiere suscripción. Elige tu plan para continuar."
      )
    }

    const deadline = sub.current_period_end

    if (!deadline) {
      throw new PaymentRequiredError(
        "Suscripción vencida. Renueva tu plan Cloud para continuar."
      )
    }

    const graceEndsAt = deadline.getTime() + GRACE_DAYS * DAY_MS
    if (Date.now() <= graceEndsAt) return

    throw new PaymentRequiredError(
      "Suscripción vencida. Renueva tu plan Cloud para continuar."
    )
  }
}