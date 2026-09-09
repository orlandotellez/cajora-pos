import type { ISettingsRepository } from "../domain/settings.interface"
import type { ISettingsResponse } from "../domain/settings.types"
import type { UpdateSettingsData, ISettingsEntity } from "../domain/settings.entities"
import { mapSettingsToResponse } from "./common/settings.mappers"

export const createSettingsService = (repository: ISettingsRepository) => ({
  get: async (storeId: string): Promise<ISettingsResponse> => {
    const settings = await repository.get(storeId)
    if (!settings) {
      return {
        name: "",
        low_stock_threshold: 5,
        cash_register_enabled: true,
        updated_at: new Date().toISOString(),
      }
    }
    return mapSettingsToResponse(settings)
  },

  update: async (data: UpdateSettingsData, storeId: string): Promise<ISettingsResponse> => {
    const settings = await repository.upsert(data, storeId)
    return mapSettingsToResponse(settings)
  },

  /**
   * Indica si el módulo de caja opcional está habilitado para la tienda.
   * Si no hay configuración registrada, se asume habilitado (default).
   */
  isCashRegisterEnabled: async (storeId: string): Promise<boolean> => {
    const settings = await repository.get(storeId)
    if (!settings) return true
    return settings.cash_register_enabled
  },
})
