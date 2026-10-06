/**
 * Marca como `expired` las suscripciones Cloud cuyo período pagado ya venció y que
 * quedaron con `status = 'active'`.
 *
 * Contexto: el `status` de la fila solo lo escriben los webhooks de PayPal y la
 * reconciliación, y ambos caminos pueden noarse (webhook caído, PAYPAL_ENABLED=false,
 * cobro rechazado sin evento). Una fila `active` con `current_period_end` en el
 * pasado quedaba granting acceso indefinido. Desde la regla derivada
 * (`resolveEntitlement`) el acceso ya se corta igual sin tocar la fila; este script
 * existe para que los paneles, la salud de suscripciones y los reportes digan la
 * verdad también.
 *
 * Es idempotente: solo escribe filas que efectivamente cambian, y corre en una
 * transacción. NO toca suscripciones `pending`, `canceled` ni `expired`.
 *
 * Uso:
 *   bun src/scripts/expire-stale-subscriptions.ts            → solo reporta
 *   bun src/scripts/expire-stale-subscriptions.ts --apply    → escribe
 *
 * ⚠ Revisá `DATABASE_URL` antes de correr con `--apply`. Con `--apply` contra el
 * entorno equivocado modificás producción desde una máquina local.
 */
import "dotenv/config"
import { prisma } from "@/config/prisma"
import { env } from "@/config/env"
import { GRACE_DAYS } from "@/modules/subscriptions/domain/subscription.entitlement"

const APPLY = process.argv.includes("--apply")
const GRACE_MS = GRACE_DAYS * 86_400_000

/**
 * Misma regla que `resolveEntitlement`: vencido = período + gracia ya pasó.
 * Se escribe en SQL directo (no `findMany` + update en loop) para que la
 * identificación y la escritura sean el mismo criterio y no haya ventana.
 */
const SELECT_STALE = `
  SELECT store_id,
         status,
         current_period_end,
         current_period_end + (${GRACE_DAYS} * interval '1 day') AS grace_ends_at
    FROM subscriptions
   WHERE mode = 'cloud'
     AND status IN ('active', 'past_due')
     AND current_period_end IS NOT NULL
     AND current_period_end + (${GRACE_DAYS} * interval '1 day') < now()
   ORDER BY current_period_end ASC
`

interface StaleRow {
  store_id: string
  status: string
  current_period_end: Date
  grace_ends_at: Date
}

async function main() {
  console.log(`Base de datos: ${redact(env.DATABASE_URL)}`)
  console.log(`Modo: ${APPLY ? "ESCRITURA (--apply)" : "solo reporte (sin cambios)"}\n`)

  const rows = await prisma.$queryRawUnsafe<StaleRow[]>(SELECT_STALE)

  if (rows.length === 0) {
    console.log("✓ Ninguna suscripción vencida con estado active/past_due. No hay nada que reparar.")
    return
  }

  console.log(`Se encontraron ${rows.length} suscripción(es) vencidas sin corregir:\n`)
  for (const row of rows) {
    console.log(
      `  store ${row.store_id}  status=${row.status}  venció=${row.current_period_end.toISOString()}  gracia hasta=${row.grace_ends_at.toISOString()}`,
    )
  }

  if (!APPLY) {
    console.log("\nSin cambios. Corré con --apply para marcarlas como expired.")
    return
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.$executeRawUnsafe(
      `UPDATE subscriptions
          SET status = 'expired', updated_at = now()
        WHERE mode = 'cloud'
          AND status IN ('active', 'past_due')
          AND current_period_end IS NOT NULL
          AND current_period_end + (${GRACE_DAYS} * interval '1 day') < now()`,
    )
    return result
  })

  console.log(`\n✓ ${updated} suscripción(es) marcadas como expired.`)
}

function redact(url: string): string {
  return url.replace(/\/\/[^@]*@/, "// *** @")
}

main()
  .catch((err: unknown) => {
    console.error("❌ Error:", err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })