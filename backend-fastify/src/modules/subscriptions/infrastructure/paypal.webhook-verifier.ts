import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import { baseUrl, getAccessToken } from "./paypal.client"

const TRUSTED_CERT_HOSTS = [
  "api.paypal.com",
  "api-m.paypal.com",
  "api.sandbox.paypal.com",
  "api-m.sandbox.paypal.com",
]

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = headers[key]
  return Array.isArray(value) ? value[0] : value
}

export function isTrustedCertUrl(certUrl: string | undefined): boolean {
  if (!certUrl) return false
  let url: URL
  try {
    url = new URL(certUrl)
  } catch {
    return false
  }
  return url.protocol === "https:" && TRUSTED_CERT_HOSTS.includes(url.hostname)
}

export async function verifyPayPalWebhook(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): Promise<boolean> {
  if (!env.PAYPAL_ENABLED) return true

  const webhookId = env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return false

  const authAlgo = getHeader(headers, "paypal-auth-algo")
  const certUrl = getHeader(headers, "paypal-cert-url")
  const transmissionId = getHeader(headers, "paypal-transmission-id")
  const transmissionSig = getHeader(headers, "paypal-transmission-sig")
  const transmissionTime = getHeader(headers, "paypal-transmission-time")

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false
  }
  if (!isTrustedCertUrl(certUrl)) {
    return false
  }

  let webhookEvent: unknown
  try {
    webhookEvent = JSON.parse(rawBody)
  } catch {
    return false
  }

  const res = await fetch(`${baseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  })

  if (!res.ok) {
    if (res.status >= 500) {
      throw new AppError(
        `PayPal verify-webhook-signature devolvió ${res.status}`,
        502,
        "PAYPAL_VERIFY_UNAVAILABLE",
      )
    }
    return false
  }

  const data = (await res.json().catch(() => null)) as { verification_status?: string } | null
  return data?.verification_status === "SUCCESS"
}
