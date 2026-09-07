/**
 * Lista los planes de suscripción de PayPal (activos e inactivos).
 * Uso: pnpm plan:list   → lista planes del entorno configurado (sandbox/live según 
 * PAYPAL_SANDBOX) Usa el mismo flujo OAuth2 client_credentials que create-paypal-plan.
 * ts, por eso lee las mismas variables de entorno del backend (PAYPAL_CLIENT_ID, 
 * PAYPAL_CLIENT_SECRET,PAYPAL_SANDBOX). También se pueden ver en la cuenta de PayPal:
 *
 * Sandbox: https://www.sandbox.paypal.com/billing/subscriptions
 * Live:   https://www.paypal.com/billing/subscriptions
 */

import "dotenv/config"
import { env } from "@/config/env"

interface PayPalPlan {
  id: string
  name: string
  description: string
  product_id: string
  status: string
  billing_cycles: Array<{
    frequency: { interval_unit: string; interval_count: number }
    tenure_type: string
    total_cycles: number
    pricing_scheme: { fixed_price?: { value: string; currency_code: string } }
  }>
  payment_preferences: {
    auto_bill_outstanding: boolean
    payment_failure_threshold: number
  }
  create_time: string
  update_time?: string
}

interface PayPalListResponse {
  plans?: PayPalPlan[]
  total_items?: number
  total_amount?: { currency_code: string; value: string }
  next_id?: string
}

function baseUrl(): string {
  return env.PAYPAL_SANDBOX ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
}

function maskSecret(secret: string): string {
  if (!secret) return "(vacío)"
  return secret.length > 4 ? `${secret.slice(0, 4)}${"*".repeat(secret.length - 4)}` : "****"
}

async function paypalFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; name?: string; details?: Array<{ description?: string; field?: string }> } | null
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
  const clientId = env.PAYPAL_CLIENT_ID
  const clientSecret = env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      `Falta configurar las credenciales de PayPal en backend-fastify/.env.\n` +
      `   Necesitás las variables PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.\n` +
      `   - Sandbox: https://developer.paypal.com/developer/accounts (cuenta business sandbox)\n` +
      `   - Live:   https://developer.paypal.com/developer/accounts (cuenta business real)\n` +
      `   Revisá también PAYPAL_SANDBOX (true = sandbox, false/omitido = live).`,
    )
  }

  const base = baseUrl()

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  console.log(`🔑 OAuth2 client_credentials → ${base}`)
  console.log(`   CLIENT_ID     : ${maskSecret(clientId)}`)
  console.log(`   CLIENT_SECRET : ${maskSecret(clientSecret)} (redactado)`)
  console.log("")

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        `PayPal rechazó la operación (401): credenciales inválidas o entorno incorrecto.\n` +
        `   - Si PAYPAL_SANDBOX=true, usá las credenciales de una cuenta BUSINESS SANDBOX.\n` +
        `     (sandbox: https://www.sandbox.paypal.com  ·  mayúsculas/minúsculas importan)\n` +
        `   - Si PAYPAL_SANDBOX=false, usá las credenciales de una cuenta BUSINESS REAL.\n` +
        `   - El CLIENT_ID temprano del dashboard de developer a veces no funciona para REST:\n` +
        `     generá un "OAuth2 Client" (Application) en developer.paypal.com > My Apps.\n` +
        `   - URL usada: ${base}`,
      )
    }

    const body = (await res.json().catch(() => null)) as { message?: string; name?: string; details?: Array<{ description?: string; field?: string }> } | null
    const detail = body?.message || body?.name || `HTTP ${res.status}`
    const fields = (body?.details ?? [])
      .map((d) => `${d.description ?? d.field ?? ""}`.trim())
      .filter(Boolean)
      .join(" | ")
    throw new Error(`PayPal rechazó la obtención del token (${res.status}): ${detail}${fields ? ` — ${fields}` : ""}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error("No se pudo obtener el access token de PayPal (revisá CLIENT_ID/SECRET)")
  }
  return data.access_token
}

function planPrice(billing_cycles: PayPalPlan["billing_cycles"]): string {
  const c = billing_cycles?.[0]?.pricing_scheme?.fixed_price
  if (!c) return "—"
  return `${c.value} ${c.currency_code}`
}

function planFrequency(billing_cycles: PayPalPlan["billing_cycles"]): string {
  const c = billing_cycles?.[0]
  if (!c) return "—"
  const unit = c.frequency.interval_unit?.toLowerCase() ?? "—"
  const count = c.frequency.interval_count ?? 0
  const tenure = c.tenure_type === "REGULAR" ? (c.total_cycles === 0 ? "∞" : c.total_cycles) : "—"
  return `${count} ${unit}${tenure !== "—" ? ` (${tenure})` : ""}`
}

async function main() {
  const token = await getAccessToken()
  console.log(`✅ Token OAuth2 obtenido (${env.PAYPAL_SANDBOX ? "sandbox" : "live"})`)
  console.log("")
  console.log(`Entorno: ${env.PAYPAL_SANDBOX ? "sandbox" : "live"}`)
  console.log(`API base: ${baseUrl().replace("/api-m.", "")}`)
  console.log("")

  let plans: PayPalPlan[] = []
  let pageToken: string | undefined

  do {
    const listPath = new URL("/v1/billing/plans", baseUrl())
    if (pageToken) listPath.searchParams.set("page", "1")
    const res = await paypalFetch(listPath.pathname + listPath.search, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json()) as PayPalListResponse
    plans.push(...(data.plans ?? []))
    pageToken = (data as { next_id?: string }).next_id
    if (!pageToken) break
  } while (true)

  if (plans.length === 0) {
    console.log("No hay planes de suscripción asociados a esta cuenta.")
    return
  }

  console.log(`📋 ${plans.length} plano(s):`)
  console.log("")
  console.table(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      price: planPrice(p.billing_cycles),
      frecuencia: planFrequency(p.billing_cycles),
      producto: p.product_id,
      creado: new Date(p.create_time).toLocaleString("es-MX"),
    })),
  )

  console.log("")
  console.log("IDs útiles para el .env:")
  for (const p of plans) {
    if (p.status === "ACTIVE") {
      console.log(`   - ${p.name}: PAYPAL_PLAN_ID_MONTHLY=${p.id}`)
    }
  }
}

main()
  .catch((err: unknown) => {
    console.error("❌ Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
