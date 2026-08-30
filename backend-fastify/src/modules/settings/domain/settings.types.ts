export interface ISettingsResponse {
  name: string
  address?: string
  phone?: string
  low_stock_threshold: number
  ticket_footer?: string
  cash_register_enabled: boolean
  updated_at: string
}
