import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { env } from "@/config/env"
import { SubscriptionRepository } from "./subscription.prisma.repository"
import { createReconciliationService } from "../application/reconciliation.service"

const reconciliationService = createReconciliationService(SubscriptionRepository)

export const reconciliationSchedulerPlugin = async (
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
) => {
  if (!env.PAYPAL_ENABLED) {
    fastify.log.info("Reconciliation scheduler desactivado (PAYPAL_ENABLED=false)")
    return
  }

  let isRunning = false

  const runOnce = async () => {
    if (isRunning) {
      fastify.log.warn("Pasada de reconciliación previa aún corriendo — se omite esta")
      return
    }
    isRunning = true
    try {
      await reconciliationService.run(fastify.log)
    } catch (err) {
      fastify.log.error({ err }, "Pasada de reconciliación falló")
    } finally {
      isRunning = false
    }
  }

  const timer = setInterval(runOnce, env.RECONCILE_INTERVAL_MS)
  timer.unref()

  if (env.RECONCILE_ON_START) {
    void runOnce()
  }

  fastify.addHook("onClose", (_instance, done) => {
    clearInterval(timer)
    done()
  })
}
