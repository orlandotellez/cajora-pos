import type { FastifyReply, FastifyRequest } from "fastify"
import { ForbiddenError } from "@/core/errors/AppError"
import { createSubscriptionService } from "../application/subscription.service"
import { SubscriptionRepository } from "../infrastructure/subscription.prisma.repository"
import {
  ActivateSubscriptionDtoSchema,
  CheckoutSubscriptionDtoSchema,
} from "./subscription.dto"

const subscriptionService = createSubscriptionService(SubscriptionRepository)

function requireStoreId(request: FastifyRequest): string {
  const storeId = request.storeId
  if (!storeId) {
    throw new ForbiddenError("Store context required", "STORE_CONTEXT_REQUIRED")
  }
  return storeId
}

export const subscriptionController = {
  getMine: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.getByStore(requireStoreId(request))
    return reply.status(200).send(result)
  },

  cloud: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.elegirCloud(requireStoreId(request))
    return reply.status(200).send(result)
  },

  checkout: async (request: FastifyRequest, reply: FastifyReply) => {
    const { return_url, cancel_url } = CheckoutSubscriptionDtoSchema.parse(request.body)
    const result = await subscriptionService.checkout(requireStoreId(request), return_url, cancel_url)
    return reply.status(200).send(result)
  },

  activate: async (request: FastifyRequest, reply: FastifyReply) => {
    const { paypal_subscription_id } = ActivateSubscriptionDtoSchema.parse(request.body)
    const result = await subscriptionService.activate(
      requireStoreId(request),
      paypal_subscription_id,
    )
    return reply.status(200).send(result)
  },

  cancel: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.cancel(requireStoreId(request))
    return reply.status(200).send(result)
  },

  reactivate: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.reactivate(requireStoreId(request))
    return reply.status(200).send(result)
  },
}
