import { Prisma } from "@prisma/client"
import type { IPrinterResponse, PrinterRole, PrinterConnType, PrinterProfile, PrinterActualStatus, PrinterCutType } from "../../domain/printers.types"
import type { IPrinterEntity } from "../../domain/printers.entities"

export const PRINTER_SELECT = {
  id: true,
  store_id: true,
  name: true,
  connection_type: true,
  address: true,
  port: true,
  paper_width: true,
  profile: true,
  codepage: true,
  auto_cut: true,
  cut_type: true,
  open_cash_drawer: true,
  default_copies: true,
  role: true,
  is_default: true,
  is_active: true,
  last_status: true,
  last_seen_at: true,
  created_at: true,
  updated_at: true,
} as const

export type PrinterRecord = Prisma.printerGetPayload<{ select: typeof PRINTER_SELECT }>

export function mapRecordToEntity(row: PrinterRecord): IPrinterEntity {
  return {
    id: row.id,
    store_id: row.store_id,
    name: row.name,
    connection_type: row.connection_type as PrinterConnType,
    address: row.address,
    port: row.port,
    paper_width: row.paper_width,
    profile: row.profile as PrinterProfile,
    codepage: row.codepage,
    auto_cut: row.auto_cut,
    cut_type: row.cut_type as PrinterCutType | null,
    open_cash_drawer: row.open_cash_drawer,
    default_copies: row.default_copies,
    role: row.role as PrinterRole,
    is_default: row.is_default,
    is_active: row.is_active,
    last_status: row.last_status as PrinterActualStatus,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapEntityToResponse(entity: IPrinterEntity): IPrinterResponse {
  return {
    id: entity.id,
    store_id: entity.store_id,
    name: entity.name,
    connection_type: entity.connection_type,
    address: entity.address,
    port: entity.port,
    paper_width: entity.paper_width,
    profile: entity.profile,
    codepage: entity.codepage,
    auto_cut: entity.auto_cut,
    cut_type: entity.cut_type,
    open_cash_drawer: entity.open_cash_drawer,
    default_copies: entity.default_copies,
    role: entity.role,
    is_default: entity.is_default,
    is_active: entity.is_active,
    last_status: entity.last_status,
    last_seen_at: entity.last_seen_at instanceof Date ? entity.last_seen_at.toISOString() : entity.last_seen_at,
    created_at: entity.created_at instanceof Date ? entity.created_at.toISOString() : entity.created_at,
    updated_at: entity.updated_at instanceof Date ? entity.updated_at.toISOString() : entity.updated_at,
  }
}