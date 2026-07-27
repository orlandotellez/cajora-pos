import { Prisma } from "@prisma/client"
import { prisma } from "@/config/prisma"
import type { IPrinterRepository } from "../domain/printers.interface"
import type { IPrinterEntity, CreatePrinterData, UpdatePrinterData } from "../domain/printers.entities"
import type {
  PrinterConnType,
  PrinterProfile,
  PrinterActualStatus,
  PrinterRole,
  PrinterCutType,
} from "../domain/printers.types"

const printerSelect = {
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

type PrinterRecord = Prisma.printerGetPayload<{ select: typeof printerSelect }>

function mapToEntity(row: PrinterRecord): IPrinterEntity {
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

export const PrinterRepository: IPrinterRepository = {
  async findByStore(storeId: string): Promise<IPrinterEntity[]> {
    const rows = await prisma.printer.findMany({
      where: { store_id: storeId, deleted_at: null },
      select: printerSelect,
      orderBy: [{ is_default: "desc" }, { name: "asc" }],
    })
    return rows.map(mapToEntity)
  },

  async findById(id: string, storeId: string): Promise<IPrinterEntity | null> {
    const row = await prisma.printer.findFirst({
      where: { id, store_id: storeId, deleted_at: null },
      select: printerSelect,
    })
    return row ? mapToEntity(row) : null
  },

  async findDefault(storeId: string, role: PrinterRole): Promise<IPrinterEntity | null> {
    const row = await prisma.printer.findFirst({
      where: { store_id: storeId, role, is_default: true, is_active: true, deleted_at: null },
      select: printerSelect,
    })
    return row ? mapToEntity(row) : null
  },

  async create(data: CreatePrinterData): Promise<IPrinterEntity> {
    const row = await prisma.printer.create({
      data: {
        store_id: data.store_id,
        name: data.name,
        connection_type: data.connection_type,
        address: data.address,
        port: data.port ?? null,
        paper_width: data.paper_width,
        profile: data.profile,
        codepage: data.codepage ?? "PC850",
        auto_cut: data.auto_cut ?? true,
        cut_type: data.cut_type ?? null,
        open_cash_drawer: data.open_cash_drawer ?? false,
        default_copies: data.default_copies ?? 1,
        role: data.role,
        is_default: data.is_default ?? false,
        is_active: data.is_active ?? true,
      },
      select: printerSelect,
    })
    return mapToEntity(row)
  },

  async update(id: string, storeId: string, data: UpdatePrinterData): Promise<IPrinterEntity> {
    const row = await prisma.printer.update({
      where: { id, store_id: storeId, deleted_at: null },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.port !== undefined && { port: data.port }),
        ...(data.paper_width !== undefined && { paper_width: data.paper_width }),
        ...(data.profile !== undefined && { profile: data.profile }),
        ...(data.codepage !== undefined && { codepage: data.codepage }),
        ...(data.auto_cut !== undefined && { auto_cut: data.auto_cut }),
        ...(data.cut_type !== undefined && { cut_type: data.cut_type }),
        ...(data.open_cash_drawer !== undefined && { open_cash_drawer: data.open_cash_drawer }),
        ...(data.default_copies !== undefined && { default_copies: data.default_copies }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.is_default !== undefined && { is_default: data.is_default }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
      select: printerSelect,
    })
    return mapToEntity(row)
  },

  async clearDefaultForRole(storeId: string, role: PrinterRole, exceptId?: string): Promise<void> {
    await prisma.printer.updateMany({
      where: {
        store_id: storeId,
        role,
        is_default: true,
        deleted_at: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { is_default: false },
    })
  },

  async softDelete(id: string, storeId: string): Promise<IPrinterEntity> {
    const row = await prisma.printer.update({
      where: { id, store_id: storeId, deleted_at: null },
      data: { deleted_at: new Date(), is_active: false },
      select: printerSelect,
    })
    return mapToEntity(row)
  },

  async existsByName(storeId: string, name: string, exceptId?: string): Promise<boolean> {
    const count = await prisma.printer.count({
      where: {
        store_id: storeId,
        name,
        deleted_at: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    })
    return count > 0
  },
}
