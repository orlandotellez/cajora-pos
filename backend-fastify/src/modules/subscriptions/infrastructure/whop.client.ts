import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import type { WhopMembership } from "../domain/whop-membership"

// El contrato de la membership vive en el dominio (`domain/whop-membership.ts`),
// porque es el dominio quien razona sobre sus estados. Acá solo se consume y se
// re-exporta para que un llamador no tenga que conocer los dos módulos.
export type { WhopMembership }

const WHOP_BASE_URL = "https://api.whop.com/api/v1"

/** Timeout de red, igual que en la verificación de PayPal. */
const REQUEST_TIMEOUT_MS = 10_000

interface WhopErrorBody {
  message?: string
  error?: string
}

/**
 * `fetch` con el timeout y el manejo de error de red del cliente PayPal.
 * La API key nunca se registra en logs: solo se inyecta en el header Authorization.
 */
async function whopFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch {
    throw new AppError("No se pudo conectar con Whop", 502, "WHOP_NETWORK_ERROR")
  }
}

async function whopRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await whopFetch(`${WHOP_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.WHOP_API_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  // Un 404 se propaga con su statusCode para que el llamador reuse el patrón de
  // "recurso huérfano" (la membership desapareció en Whop pero la fila sigue en DB).
  if (res.status === 404) {
    throw new AppError("El recurso solicitado no existe en Whop", 404, "WHOP_NOT_FOUND")
  }

  if (res.status === 204) {
    return undefined as T
  }

  const body = (await res.json().catch(() => null)) as (T & WhopErrorBody) | null

  if (!res.ok) {
    throw new AppError("Fallo temporal del proveedor de pagos", 502, "WHOP_UPSTREAM_ERROR")
  }

  return body as T
}

export const whopClient = {
  /** Lee el estado real de la membership: los webhooks de Whop solo disparan, la API decide. */
  async getMembership(id: string): Promise<WhopMembership> {
    return whopRequest<WhopMembership>(`/memberships/${encodeURIComponent(id)}`)
  },

  /**
   * Programa la cancelación al final del periodo vigente. Un 404 significa que la
   * membership ya no existe en Whop, así que el objetivo (dejar de cobrar) ya está
   * cumplido: no se propaga como error.
   */
  async cancelMembership(id: string): Promise<void> {
    try {
      await whopRequest<unknown>(`/memberships/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      })
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return
      }
      throw error
    }
  },

  /** Revierte una cancelación programada para que la membership vuelva a renovar. */
  async reactivateMembership(id: string): Promise<void> {
    await whopRequest<unknown>(`/memberships/${encodeURIComponent(id)}/reactivate`, {
      method: "POST",
    })
  },
}

export { WHOP_BASE_URL }
