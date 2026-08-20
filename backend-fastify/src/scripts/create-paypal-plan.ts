/**
 * Crea (o reutiliza) el producto y el plan de suscripción mensual en PayPal.
 *
 * Uso:
 *   pnpm plan:create          → crea o reutiliza el plan $15.99/mes e imprime el plan_id
 *   pnpm plan:create --force  → fuerza la creación de un plan nuevo (ignora el .env)
 *
 * - Sandbox o live según PAYPAL_SANDBOX del .env (no toca PAYPAL_ENABLED: habla
 *   directo con la API REST usando las credenciales OAuth2).
 * - Idempotente: si PAYPAL_PLAN_ID_MONTHLY ya está configurado y es válido, no
 *   crea nada. Si no, busca por nombre antes de crear (evita duplicados al
 *   correr dos veces).
 * - El plan NO lleva trial de PayPal a propósito (decisión D0.2): el pago es
 *   inmediato — la tarjeta se pide al suscribirse.
 */
import "dotenv/config"
import { env } from "@/config/env"

const PRODUCT_NAME = "CajoraPOS Cloud"
const PRODUCT_DESCRIPTION = "Plan Cloud de CajoraPOS: suscripción mensual con hosting y respaldos."
const PLAN_NAME = "CajoraPOS Cloud — Mensual $15.99"
const PLAN_DESCRIPTION = "Acceso al plan Cloud de CajoraPOS: $15.99 USD por mes."
const PRICE_USD = "15.99"

interface PayPalProduct {
  id: string
  name: string
}

interface PayPalPlan {
  id: string
  name: string
  status?: string
}

interface PayPalErrorBody {
  message?: string
  name?: string
  details?: Array<{ description?: string; field?: string }>
}

function baseUrl(): string {
  return env.PAYPAL_SANDBOX ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
}

async function paypalFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as PayPalErrorBody | null
    const detail = body?.message || body?.name || `HTTP ${res.status}`
    const fields = (body?.details ?? [])
      .map((d) => `${d.description ?? d.field ?? ""}`.trim())
      .filter(Boolean)
      .join(" | ")
    throw new Error(`PayPal rechazó la operación (${res.status}): ${detail}${fields ? ` — ${fields}` : ""}`)
  }
  return res
}

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64")

  const res = await paypalFetch("/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error("No se pudo obtener el access token de PayPal (revisá CLIENT_ID/SECRET)")
  }
  return data.access_token
}

async function paypalGet<T>(token: string, path: string): Promise<T> {
  const res = await paypalFetch(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json() as Promise<T>
}

async function paypalPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await paypalFetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

/** Busca el producto por nombre; si no existe, lo crea. Devuelve su product_id. */
async function ensureProduct(token: string): Promise<string> {
  const list = await paypalGet<{ products?: PayPalProduct[] }>(
    token,
    "/v1/catalogs/products?page_size=50&total_required=true",
  )
  const existing = list.products?.find((p) => p.name === PRODUCT_NAME)
  if (existing) {
    console.log(`ℹ️  Producto existente: ${existing.name} (${existing.id})`)
    return existing.id
  }

  const created = await paypalPost<PayPalProduct>(token, "/v1/catalogs/products", {
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    type: "SERVICE",
    category: "SOFTWARE",
  })
  console.log(`✅ Producto creado: ${created.name} (${created.id})`)
  return created.id
}

/** Busca el plan por nombre; si no existe, lo crea con facturación mensual de $15.99 USD. */
async function ensurePlan(token: string, productId: string, force: boolean): Promise<string> {
  // ⚠️ Sin page_size en este endpoint: /v1/billing/plans rechaza page_size>20
  // (a diferencia de /v1/catalogs/products que acepta 50).
  // El listado pagina de a 20: hoy alcanza, pero si se acumulan planes podría
  // duplicar por no ver la página 2.
  if (!force) {
    const list = await paypalGet<{ plans?: PayPalPlan[] }>(token, "/v1/billing/plans")
    // Solo reutiliza planes ACTIVOS: un plan INACTIVE (desactivado en el dashboard)
    // no debe silenciosamente quedar en uso.
    const existing = list.plans?.find((p) => p.name === PLAN_NAME && p.status === "ACTIVE")
    if (existing) {
      console.log(`ℹ️  Plan existente: ${existing.name} (${existing.id}, status ${existing.status})`)
      return existing.id
    }
  }

  const created = await paypalPost<PayPalPlan>(token, "/v1/billing/plans", {
    product_id: productId,
    name: PLAN_NAME,
    description: PLAN_DESCRIPTION,
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0, // 0 = indefinido (renovación mensual automática)
        pricing_scheme: {
          fixed_price: { value: PRICE_USD, currency_code: "USD" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  })
  console.log(`✅ Plan creado: ${created.name} (${created.id})`)
  return created.id
}

async function main() {
  const force = process.argv.includes("--force")

  // Idempotente: si ya hay un plan VÁLIDO (ACTIVE) en el entorno, no crear duplicados.
  if (env.PAYPAL_PLAN_ID_MONTHLY && !force) {
    try {
      const plan = await paypalGet<PayPalPlan>(
        await getAccessToken(),
        `/v1/billing/plans/${env.PAYPAL_PLAN_ID_MONTHLY}`,
      )
      if (plan.status !== "ACTIVE") {
        console.log(
          `⚠️  El plan configurado ${plan.id} está ${plan.status} — no sirve para suscripciones nuevas. Creo uno nuevo...`,
        )
      } else {
        console.log(`ℹ️  PAYPAL_PLAN_ID_MONTHLY ya configurado y válido: ${plan.id} (${plan.status})`)
        console.log(`   Nada que hacer. Usá --force para crear un plan nuevo.`)
        return
      }
    } catch {
      console.log(
        `⚠️  PAYPAL_PLAN_ID_MONTHLY configurado (${env.PAYPAL_PLAN_ID_MONTHLY}) pero no existe en PayPal. Creo uno nuevo...`,
      )
    }
  }

  const token = await getAccessToken()
  console.log("✅ Token OAuth2 obtenido")

  const productId = await ensureProduct(token)
  const planId = await ensurePlan(token, productId, force)

  console.log("")
  console.log(`🔑 PLAN_ID: ${planId}`)
  console.log(`   Copialo a backend-fastify/.env:`)
  console.log(`   PAYPAL_PLAN_ID_MONTHLY=${planId}`)
}

main()
  .catch((err: unknown) => {
    console.error("❌ Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
