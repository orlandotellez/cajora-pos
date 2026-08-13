import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { webhookController } from "./webhook.controller"

const TAGS = ["Webhooks"]

export const webhookRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    done(null, body)
  })

  fastify.post("/", {
    schema: { tags: TAGS, description: "Webhook de PayPal (Billing Subscriptions) — verificación de firma + dedup" },
    config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
  }, webhookController.receive)
}
