import type { FastifyReply, FastifyRequest } from "fastify"
import { env } from "@/config/env"
import { PaymentRequiredError } from "@/core/errors/AppError"
import { getAuthResultFromRequest } from "@/modules/auth/application/common/auth.utils"
import { resolveEntitlement } from "@/modules/subscriptions/domain/subscription.entitlement"
import type { ISubscriptionRepository } from "@/modules/subscriptions/domain/subscription.interface"

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

    // El `status` de la fila solo cambia cuando PayPal lo reporta por webhook o por
    // reconciliación, y ambos caminos pueden noarse. El acceso se decide siempre
    // contra `current_period_end`, nunca contra el status guardado.
    const { allowed, state } = resolveEntitlement(sub)

    if (allowed) return

    if (state === "pending") {
      throw new PaymentRequiredError(
        "Plan Cloud requiere suscripción. Elige tu plan para continuar."
      )
    }

    throw new PaymentRequiredError("Suscripción vencida. Renueva tu plan Cloud para continuar.")
  }
}