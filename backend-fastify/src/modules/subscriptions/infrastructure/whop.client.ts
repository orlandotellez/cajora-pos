import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import type { WhopMembership } from "../domain/whop-membership"

// El contrato de la membership vive en el dominio (`domain/whop-membership.ts`),
// porque es el dominio quien razona sobre sus estados. Acá solo se consume y se
// re-exporta para que un llamador no tenga que conocer los dos módulos.
export type { WhopMembership }

const WHOP_PRODUCTION_BASE_URL = "https://api.whop.com/api/v1"
const WHOP_SANDBOX_BASE_URL = "https://sandbox-api.whop.com/api/v1"

/**
 * URL base de la API según el entorno. Se resuelve **por llamada** y no al importar, para
 * que `WHOP_SANDBOX` se pueda cambiar sin recargar el módulo.
 *
 * El sandbox tiene su propia base y sus propias credenciales: una membership de sandbox no
 * existe en producción ni al revés.
 */
export function whopBaseUrl(): string {
  return env.WHOP_SANDBOX ? WHOP_SANDBOX_BASE_URL : WHOP_PRODUCTION_BASE_URL
}

/** Timeout de red, igual que en la verificación de PayPal. */
const REQUEST_TIMEOUT_MS = 10_000

/** Cuántas páginas del listado se siguen como máximo (la búsqueda es por email). */
const MEMBERSHIP_LIST_MAX_PAGES = 3

interface WhopErrorBody {
  message?: string
  error?: string
}

/**
 * Envelope paginado del listado de memberships. La API puede devolver el array
 * pelado o dentro de `data`; ambas formas se aceptan para no depender del detalle
 * de versión del endpoint.
 */
interface WhopMembershipListPage {
  data?: WhopMembership[]
  page_info?: { has_next_page?: boolean; end_cursor?: string | null }
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
  const res = await whopFetch(`${whopBaseUrl()}${path}`, {
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
    // El status y el mensaje de Whop van en el error a propósito: un 401 por usar una key
    // de sandbox contra la API de producción se veía como "fallo temporal del proveedor" y
    // costó una sesión entera de diagnóstico. El statusCode sigue siendo 502 (el fallo es
    // del upstream desde el punto de vista del cliente), pero el texto dice la verdad.
    const detail = body?.message ?? body?.error ?? ""
    throw new AppError(
      `Whop respondió ${res.status}${detail ? `: ${detail}` : ""}`,
      502,
      "WHOP_UPSTREAM_ERROR",
    )
  }

  return body as T
}

export const whopClient = {
  /** Lee el estado real de la membership: los webhooks de Whop solo disparan, la API decide. */
  async getMembership(id: string): Promise<WhopMembership> {
    return whopRequest<WhopMembership>(`/memberships/${encodeURIComponent(id)}`)
  },

  /**
   * Lista las memberships de la cuenta. Se usa para reconciliar una compra que Whop
   * no llegó a notificar por webhook (el evento pudo perderse o demorarse).
   *
   * Como el objetivo es encontrar UNA membership por el email del comprador, alcanza
   * con unas pocas páginas: no se recorre el historial completo del negocio. Si la
   * respuesta trae cursor, se siguen como máximo `MEMBERSHIP_LIST_MAX_PAGES` páginas.
   */
  async listMemberships(limit = 100): Promise<WhopMembership[]> {
    const collected: WhopMembership[] = []
    let after: string | null = null

    for (let page = 0; page < MEMBERSHIP_LIST_MAX_PAGES; page++) {
      const query: string = after ? `?after=${encodeURIComponent(after)}` : ""
      const body: WhopMembershipListPage | WhopMembership[] = await whopRequest<
        WhopMembershipListPage | WhopMembership[]
      >(`/memberships${query}`)

      // Envelope variable según versión de la API: array pelado o `{ data }`.
      if (Array.isArray(body)) {
        collected.push(...body)
        break
      }
      const items: WhopMembership[] = Array.isArray(body?.data) ? body.data : []
      collected.push(...items)

      const info: WhopMembershipListPage["page_info"] = body?.page_info
      if (!info?.has_next_page || !info.end_cursor) break
      after = info.end_cursor
    }

    return collected.slice(0, Math.max(0, limit))
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

export { WHOP_PRODUCTION_BASE_URL, WHOP_SANDBOX_BASE_URL }
