import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { whopWebhookController } from "./whop-webhook.controller"

const TAGS = ["Webhooks"]

export const whopWebhookRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  // El body debe llegar crudo: la firma se calcula sobre los bytes exactos.
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    done(null, body)
  })

  fastify.post("/", {
    schema: { tags: TAGS, description: "Webhook de Whop (memberships/payments) — verificación de firma + dedup" },
    config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
  }, whopWebhookController.receive)
}
