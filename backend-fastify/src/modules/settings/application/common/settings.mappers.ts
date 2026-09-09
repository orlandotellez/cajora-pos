import type { ISettingsEntity } from "../../domain/settings.entities"
import type { ISettingsResponse } from "../../domain/settings.types"

export function mapSettingsToResponse(settings: ISettingsEntity): ISettingsResponse {
  return {
    name: settings.name,
    address: settings.address || undefined,
    phone: settings.phone || undefined,
    low_stock_threshold: settings.low_stock_threshold,
    ticket_footer: settings.ticket_footer || undefined,
    cash_register_enabled: settings.cash_register_enabled,
    updated_at: settings.updated_at instanceof Date ? settings.updated_at.toISOString() : settings.updated_at,
  }
}