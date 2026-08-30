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

export const SettingsRepository: ISettingsRepository = {
  async get(storeId: string) {
    const settings = await prisma.settings.findUnique({
      where: { store_id: storeId },
    })
    if (!settings) return null
    return mapToEntity(settings)
  },

  async upsert(data: UpdateSettingsData, storeId: string) {
    const existing = await prisma.settings.findUnique({
      where: { store_id: storeId },
    })

    if (existing) {
      const updated = await prisma.settings.update({
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

    const created = await prisma.settings.create({
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
  },
}
