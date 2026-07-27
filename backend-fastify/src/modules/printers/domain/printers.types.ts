import { PRINTER_CONN_TYPE, PRINTER_PROFILE, PRINTER_STATUS } from "@prisma/client"

export type PrinterConnType = (typeof PRINTER_CONN_TYPE)[keyof typeof PRINTER_CONN_TYPE]
export type PrinterProfile = (typeof PRINTER_PROFILE)[keyof typeof PRINTER_PROFILE]
export type PrinterActualStatus = (typeof PRINTER_STATUS)[keyof typeof PRINTER_STATUS]

export type PrinterRole = "receipt" | "kitchen" | "both"
export type PrintJobStatus = "pending" | "sent" | "success" | "failed"
export type PrinterCutType = "full" | "partial"

export interface IPrinterResponse {
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
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface IPrintJobResponse {
  id: string
  printer_id: string
  sale_id: string | null
  status: PrintJobStatus
  attempts: number
  max_attempts: number
  error_msg: string | null
  enqueued_at: string
  sent_at: string | null
  finished_at: string | null
}
