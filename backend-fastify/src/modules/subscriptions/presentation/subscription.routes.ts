import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { authGuard } from "@/modules/auth/application/common/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { subscriptionController } from "./subscription.controller"
import {
  ActivateSubscriptionDtoSchema,
  CheckoutSubscriptionDtoSchema,
  SubscriptionResponseDtoSchema,
  WhopIntentDtoSchema,
} from "./subscription.dto"

const TAGS = ["Subscriptions"]

export const subscriptionRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/mine", {
    schema: { tags: TAGS, description: "Estado de la suscripción de la tienda (cloud/self_hosted)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.getMine)

  fastify.get("/billing", {
    schema: { tags: TAGS, description: "Historial de cobros mensuales y próxima fecha de pago" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.getBilling)

  fastify.post("/checkout", {
    schema: { tags: TAGS, description: "Crear la suscripción en PayPal (aquí se pide la tarjeta)", body: toJsonSchema(CheckoutSubscriptionDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.checkout)

  fastify.post("/whop/intent", {
    schema: {
      tags: TAGS,
      description: "Emitir la referencia firmada para el checkout embebido de Whop",
      response: { 200: toJsonSchema(WhopIntentDtoSchema) },
    },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.whopIntent)

  fastify.post("/whop/sync", {
    schema: {
      tags: TAGS,
      description:
        "Reconciliar contra Whop una suscripción pagada pero todavía pending, buscando la membership por el email del dueño",
      response: { 200: toJsonSchema(SubscriptionResponseDtoSchema) },
    },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.whopSync)

  fastify.post("/activate", {
    schema: { tags: TAGS, description: "Activar la suscripción tras el onApprove de PayPal", body: toJsonSchema(ActivateSubscriptionDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.activate)

  fastify.post("/cancel", {
    schema: { tags: TAGS, description: "Cancelar al final del período (self-serve)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.cancel)

  fastify.post("/reactivate", {
    schema: { tags: TAGS, description: "Reabrir el flujo de pago (deja la suscripción en pending hasta pagar)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.reactivate)
}
