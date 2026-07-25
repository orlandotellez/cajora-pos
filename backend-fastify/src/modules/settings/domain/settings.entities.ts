export interface ISettingsEntity {
  id: number
  name: string
  address?: string
  phone?: string
  low_stock_threshold: number
  ticket_footer?: string
  updated_at: Date
}

export type UpdateSettingsData = {
  name?: string
  address?: string
  phone?: string
  low_stock_threshold?: number
  ticket_footer?: string
}
