/**
 * Corre una pasada de reconciliación de suscripciones contra PayPal (one-shot).
 *
 * Uso:
 *   pnpm reconcile   → consulta el estado real de cada suscripción PayPal
 *                      y corrige la DB donde haya drift (períodos vencidos,
 *                      ACTIVATED/SALE.COMPLETED perdidos, estados desalineados).
 *
 * - Requiere PAYPAL_ENABLED=true y credenciales válidas en el .env.
 * - Con PAYPAL_ENABLED=false (mock) no hace nada y sale sin tocar la DB.
 * - Útil también como cron del host si se prefiere no usar el scheduler interno
 *   (ej: `0 * * * * cd backend-fastify && pnpm reconcile >> /var/log/reconcile.log`).
 */
import "dotenv/config"
import { env } from "@/config/env"
import { SubscriptionRepository } from "@/modules/subscriptions/infrastructure/subscription.prisma.repository"
import { createReconciliationService } from "@/modules/subscriptions/application/reconciliation.service"

async function main() {
  if (!env.PAYPAL_ENABLED) {
    console.log("PAYPAL_ENABLED=false → modo mock, no hay nada que reconciliar. Salgo sin tocar la DB.")
    return
  }

  const service = createReconciliationService(SubscriptionRepository)
  const stats = await service.run(console)

  console.log("")
  console.log("Resumen de la reconciliación:")
  console.log(`  Revisadas   : ${stats.reviewed}`)
  console.log(`  Corregidas  : ${stats.drifted}`)
  console.log(`  Cobros retro: ${stats.paymentsBackfilled}`)
  console.log(`  Errores     : ${stats.errors}`)
}

main()
  .catch((err: unknown) => {
    console.error("❌ Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  })