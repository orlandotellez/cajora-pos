import type { FastifyReply, FastifyRequest } from "fastify"
import { ForbiddenError } from "@/core/errors/AppError"
import { createSubscriptionService } from "../application/subscription.service"
import { SubscriptionRepository } from "../infrastructure/subscription.prisma.repository"
import { SubscriptionEventRepository } from "../infrastructure/subscription-event.prisma.repository"
import { PayPalWebhookEventRepository } from "../infrastructure/paypal-webhook-event.prisma.repository"
import type { SubscriptionActor } from "../domain/subscription-event.interface"
import {
  ActivateSubscriptionDtoSchema,
  CheckoutSubscriptionDtoSchema,
} from "./subscription.dto"

const subscriptionService = createSubscriptionService(
  SubscriptionRepository,
  SubscriptionEventRepository,
  PayPalWebhookEventRepository,
)

function requireStoreId(request: FastifyRequest): string {
  const storeId = request.storeId
  if (!storeId) {
    throw new ForbiddenError("Store context required", "STORE_CONTEXT_REQUIRED")
  }
  return storeId
}

function buildActor(request: FastifyRequest): SubscriptionActor {
  return {
    userId: request.userId ?? null,
    ip: request.ip ?? null,
    userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
  }
}

export const subscriptionController = {
  getMine: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.getByStore(requireStoreId(request))
    return reply.status(200).send(result)
  },

  getBilling: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.getBilling(requireStoreId(request))
    return reply.status(200).send(result)
  },

  cloud: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.elegirCloud(requireStoreId(request), buildActor(request))
    return reply.status(200).send(result)
  },

  checkout: async (request: FastifyRequest, reply: FastifyReply) => {
    const { return_url, cancel_url } = CheckoutSubscriptionDtoSchema.parse(request.body)
    const result = await subscriptionService.checkout(
      requireStoreId(request),
      return_url,
      cancel_url,
      buildActor(request),
    )
    return reply.status(200).send(result)
  },

  activate: async (request: FastifyRequest, reply: FastifyReply) => {
    const { paypal_subscription_id } = ActivateSubscriptionDtoSchema.parse(request.body)
    const result = await subscriptionService.activate(
      requireStoreId(request),
      paypal_subscription_id,
      buildActor(request),
    )
    return reply.status(200).send(result)
  },

  cancel: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.cancel(requireStoreId(request), buildActor(request))
    return reply.status(200).send(result)
  },

  reactivate: async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await subscriptionService.reactivate(requireStoreId(request), buildActor(request))
    return reply.status(200).send(result)
  },
}
