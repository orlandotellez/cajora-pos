import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"

interface PayPalTokenResponse {
  access_token: string
  expires_in?: number
}

interface PayPalLink {
  rel: string
  href: string
}

interface PayPalSubscriptionResponse {
  id: string
  status?: string
  plan_id?: string
  links?: PayPalLink[]
}

interface PayPalErrorBody {
  message?: string
  name?: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

const TOKEN_SKEW_MS = 60_000

export function baseUrl(): string {
  return env.PAYPAL_SANDBOX
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com"
}

async function paypalFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new AppError("No se pudo conectar con PayPal", 502, "PAYPAL_NETWORK_ERROR")
  }
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_SKEW_MS) {
    return cachedToken.token
  }

  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64")

  const res = await paypalFetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  const data = (await res.json().catch(() => null)) as PayPalTokenResponse | null

  if (!res.ok || !data?.access_token) {
    throw new AppError("No se pudo autenticar con PayPal", 502, "PAYPAL_AUTH_FAILED")
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  }
  return cachedToken.token
}

async function paypalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const res = await paypalFetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body = (await res.json().catch(() => null)) as (T & PayPalErrorBody) | null

  if (!res.ok) {
    const detail = body?.message || body?.name
    if (res.status >= 400 && res.status < 500) {
      throw new AppError(
        detail || `PayPal rechazó la operación (${res.status})`,
        res.status,
        "PAYMENT_PROVIDER_REJECTED",
      )
    }
    throw new AppError("Fallo temporal del proveedor de pagos", 502, "PAYPAL_UPSTREAM_ERROR")
  }

  return body as T
}

export interface PayPalSubscription {
  id: string
  approvalUrl: string | null
  status: string
  planId: string
}

export interface PayPalSubscriptionDetail {
  id: string
  status: string
  nextBillingTime: string | null
}

export interface PayPalTransaction {
  id: string
  amount: string
  currency: string
  time: string
  status: string
}

interface PayPalTransactionItem {
  id?: string
  status?: string
  time?: string
  amount?: { total?: string; currency?: string }
  amount_with_breakdown?: {
    gross_amount?: { value?: string; currency_code?: string }
  }
}

export const paypalClient = {
  async createSubscription(
    planId: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<PayPalSubscription> {
    if (!env.PAYPAL_ENABLED) {
      return {
        id: `MOCK-${Date.now().toString(36)}`,
        approvalUrl: null,
        status: "APPROVAL_PENDING",
        planId,
      }
    }

    if (!planId) {
      throw new AppError(
        "No hay PAYPAL_PLAN_ID_MONTHLY configurado (crear el plan de $15.99 en el dashboard de PayPal)",
        422,
        "PAYPAL_PLAN_NOT_CONFIGURED",
      )
    }

    const data = await paypalRequest<PayPalSubscriptionResponse>(
      "/v1/billing/subscriptions",
      {
        method: "POST",
        body: JSON.stringify({
          plan_id: planId,
          application_context: {
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        }),
      },
    )

    return {
      id: data.id,
      approvalUrl: data.links?.find((l) => l.rel === "approve")?.href ?? null,
      status: data.status ?? "APPROVAL_PENDING",
      planId: data.plan_id ?? planId,
    }
  },

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (!env.PAYPAL_ENABLED) return true

    await paypalRequest<unknown>(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: "El usuario solicitó la cancelación desde el panel.",
        }),
      },
    )
    return true
  },

  async getSubscription(subscriptionId: string): Promise<PayPalSubscriptionDetail> {
    if (!env.PAYPAL_ENABLED) {
      return { id: subscriptionId, status: "ACTIVE", nextBillingTime: null }
    }

    const data = await paypalRequest<{
      id: string
      status?: string
      billing_info?: { next_billing_time?: string }
    }>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`)

    return {
      id: data.id,
      status: data.status ?? "UNKNOWN",
      nextBillingTime: data.billing_info?.next_billing_time ?? null,
    }
  },

  async getTransactions(
    subscriptionId: string,
    startTime: string,
    endTime: string,
  ): Promise<PayPalTransaction[]> {
    if (!env.PAYPAL_ENABLED) return []

    const query = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
    })
    const data = await paypalRequest<{ transactions?: PayPalTransactionItem[] }>(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions?${query.toString()}`,
    )

    return (data.transactions ?? []).map((t) => ({
      id: t.id ?? "",
      amount: t.amount?.total ?? t.amount_with_breakdown?.gross_amount?.value ?? "",
      currency: t.amount?.currency ?? t.amount_with_breakdown?.gross_amount?.currency_code ?? "",
      time: t.time ?? "",
      status: t.status ?? "",
    }))
  },
}
