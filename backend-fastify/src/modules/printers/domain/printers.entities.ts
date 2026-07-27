import type {
  PrinterConnType,
  PrinterProfile,
  PrinterActualStatus,
  PrinterRole,
  PrinterCutType,
} from "./printers.types"

export interface IPrinterEntity {
  id: string
  store_id: string
  name: string
  connection_type: PrinterConnType
  address: string
  port: number | null
  paper_width: number
  profile: PrinterProfile
  codepage: string
  auto_cut: boolean
  cut_type: PrinterCutType | null
  open_cash_drawer: boolean
  default_copies: number
  role: PrinterRole
  is_default: boolean
  is_active: boolean
  last_status: PrinterActualStatus
  last_seen_at: Date | null
  created_at: Date
  updated_at: Date
}

export type CreatePrinterData = {
  store_id: string
  name: string
  connection_type: PrinterConnType
  address: string
  port?: number | null
  paper_width: number
  profile: PrinterProfile
  codepage?: string
  auto_cut?: boolean
  cut_type?: PrinterCutType | null
  open_cash_drawer?: boolean
  default_copies?: number
  role: PrinterRole
  is_default?: boolean
  is_active?: boolean
}

export type UpdatePrinterData = {
  name?: string
  connection_type?: PrinterConnType
  address?: string
  port?: number | null
  paper_width?: number
  profile?: PrinterProfile
  codepage?: string
  auto_cut?: boolean
  cut_type?: PrinterCutType | null
  open_cash_drawer?: boolean
  default_copies?: number
  role?: PrinterRole
  is_default?: boolean
  is_active?: boolean
}
