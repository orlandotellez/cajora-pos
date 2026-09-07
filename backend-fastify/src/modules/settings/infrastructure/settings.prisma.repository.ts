import { prisma } from "@/config/prisma"
import type { ISettingsRepository } from "../domain/settings.interface"
import type { ISettingsEntity, UpdateSettingsData } from "../domain/settings.entities"
import type { settings } from "@prisma/client"

function mapToEntity(settings: settings): ISettingsEntity {
  return {
    id: settings.id,
    name: settings.name,
    address: settings.address || undefined,
    phone: settings.phone || undefined,
    low_stock_threshold: settings.low_stock_threshold,
    ticket_footer: settings.ticket_footer || undefined,
    cash_register_enabled: settings.cash_register_enabled,
    updated_at: settings.updated_at,
  }
}

/**
 * Campos de negocio que se reflejan en la tienda (`stores`) además de en `settings`.
 * Cuando el admin edita el nombre/dirección/teléfono en Ajustes, también se actualizan
 * en la tabla `stores` para que el super admin panel, suscripciones y JWT vean el nuevo valor.
 */
// El DTO de Zod permite `null` para address/phone (limpiar campo), pero el tipo
// `UpdateSettingsData` del dominio no lo refleja. Tipamos el mirror para tolerar
// el valor real que llega en runtime.
type StoreMirrorInput = {
  name?: string
  address?: string | null
  phone?: string | null
}

function storeMirrorFromData(data: StoreMirrorInput) {
  const mirror: { name?: string; address?: string | null; phone?: string | null } = {}
  if (data.name !== undefined) mirror.name = data.name
  if (data.address !== undefined) mirror.address = data.address
  if (data.phone !== undefined) mirror.phone = data.phone
  return mirror
}

export const SettingsRepository: ISettingsRepository = {
  async get(storeId: string) {
    const settings = await prisma.settings.findUnique({
      where: { store_id: storeId },
    })
    if (!settings) return null
    return mapToEntity(settings)
  },

  async upsert(data: UpdateSettingsData, storeId: string) {
    // Sincronizamos la tienda y los settings en una única transacción para
    // que `stores` (usada por el super admin panel, JWTs y suscripciones)
    // siempre refleje el último nombre/dirección/teléfono configurado.
    return prisma.$transaction(async (tx) => {
      const existing = await tx.settings.findUnique({
        where: { store_id: storeId },
      })

      const storeMirror = storeMirrorFromData(data)
      if (Object.keys(storeMirror).length > 0) {
        await tx.store.update({
          where: { id: storeId },
          data: storeMirror,
        })
      }

      if (existing) {
        const updated = await tx.settings.update({
          where: { id: existing.id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.low_stock_threshold !== undefined && { low_stock_threshold: data.low_stock_threshold }),
            ...(data.ticket_footer !== undefined && { ticket_footer: data.ticket_footer }),
            ...(data.cash_register_enabled !== undefined && { cash_register_enabled: data.cash_register_enabled }),
          },
        })
        return mapToEntity(updated)
      }

      const created = await tx.settings.create({
        data: {
          store_id: storeId,
          name: data.name ?? "Mi Negocio",
          address: data.address,
          phone: data.phone,
          low_stock_threshold: data.low_stock_threshold ?? 5,
          ticket_footer: data.ticket_footer,
          cash_register_enabled: data.cash_register_enabled ?? true,
        },
      })
      return mapToEntity(created)
    })
  },
}
