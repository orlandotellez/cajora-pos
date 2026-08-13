import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { authGuard } from "@/core/guard/auth.guard"
import { storeGuard } from "@/core/guard/store.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import { subscriptionController } from "./subscription.controller"
import {
  ActivateSubscriptionDtoSchema,
  CheckoutSubscriptionDtoSchema,
} from "./subscription.dto"

const TAGS = ["Subscriptions"]

export const subscriptionRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.get("/mine", {
    schema: { tags: TAGS, description: "Estado de la suscripción de la tienda (cloud/self_hosted)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.getMine)

  fastify.post("/cloud", {
    schema: { tags: TAGS, description: "Elegir modo Cloud e iniciar trial de 14 días (sin tarjeta)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.cloud)

  fastify.post("/checkout", {
    schema: { tags: TAGS, description: "Crear la suscripción en PayPal (aquí se pide la tarjeta)", body: toJsonSchema(CheckoutSubscriptionDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.checkout)

  fastify.post("/activate", {
    schema: { tags: TAGS, description: "Activar la suscripción tras el onApprove de PayPal", body: toJsonSchema(ActivateSubscriptionDtoSchema) },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.activate)

  fastify.post("/cancel", {
    schema: { tags: TAGS, description: "Cancelar al final del período (self-serve)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.cancel)

  fastify.post("/reactivate", {
    schema: { tags: TAGS, description: "Reabrir el flujo de suscripción (estado trial)" },
    preHandler: [authGuard, storeGuard],
  }, subscriptionController.reactivate)
}
