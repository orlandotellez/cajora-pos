import { Prisma } from "@prisma/client"
import { prisma } from "@/config/prisma"
import { NotFoundError, ConflictError, BadRequestError } from "@/core/errors/AppError"
import type { IPrinterRepository } from "../domain/printers.interface"
import type { IPrinterResponse, PrinterRole, PrinterConnType, PrinterProfile, PrinterActualStatus, PrinterCutType } from "../domain/printers.types"
import type { IPrinterEntity, CreatePrinterData, UpdatePrinterData } from "../domain/printers.entities"
import type { CreatePrinterDto, UpdatePrinterDto } from "../presentation/printers.dto"

const PRINTER_SELECT = {
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

type PrinterRecord = Prisma.printerGetPayload<{ select: typeof PRINTER_SELECT }>

function mapRecordToEntity(row: PrinterRecord): IPrinterEntity {
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

function mapEntityToResponse(entity: IPrinterEntity): IPrinterResponse {
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

export const createPrintersService = (repository: IPrinterRepository) => ({
  list: async (storeId: string): Promise<IPrinterResponse[]> => {
    const printers = await repository.findByStore(storeId)
    return printers.map(mapEntityToResponse)
  },

  getById: async (id: string, storeId: string): Promise<IPrinterResponse> => {
    const printer = await repository.findById(id, storeId)
    if (!printer) throw new NotFoundError("Impresora no encontrada")
    return mapEntityToResponse(printer)
  },

  create: async (data: CreatePrinterDto, storeId: string): Promise<IPrinterResponse> => {
    if (data.name.trim().length === 0) {
      throw new BadRequestError("El nombre es obligatorio")
    }

    if (await repository.existsByName(storeId, data.name)) {
      throw new ConflictError("Ya existe una impresora con ese nombre en esta tienda")
    }

    const createData: CreatePrinterData = { ...data, store_id: storeId }

    let created: IPrinterEntity
    try {
      if (data.is_default === true) {
        const row = await prisma.$transaction(async (tx) => {
          await tx.printer.updateMany({
            where: { store_id: storeId, role: data.role, is_default: true, deleted_at: null },
            data: { is_default: false },
          })
          return tx.printer.create({ data: createData, select: PRINTER_SELECT })
        })
        created = mapRecordToEntity(row)
      } else {
        created = await repository.create(createData)
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("Ya existe una impresora con ese nombre en esta tienda")
      }
      throw err
    }

    return mapEntityToResponse(created)
  },

  update: async (id: string, storeId: string, data: UpdatePrinterDto): Promise<IPrinterResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing) throw new NotFoundError("Impresora no encontrada")

    if (data.name !== undefined && data.name !== existing.name) {
      if (data.name.trim().length === 0) {
        throw new BadRequestError("El nombre es obligatorio")
      }
      if (await repository.existsByName(storeId, data.name, id)) {
        throw new ConflictError("Ya existe una impresora con ese nombre en esta tienda")
      }
    }

    const newRole = data.role ?? existing.role
    const clearTargets: Array<{ role: PrinterRole; id: string }> =
      newRole === "both"
        ? [
          { role: "receipt", id },
          { role: "kitchen", id },
          { role: "both", id },
        ]
        : [{ role: newRole, id }]

    let updated: IPrinterEntity
    try {
      if (data.is_default === true) {
        const row = await prisma.$transaction(async (tx) => {
          for (const target of clearTargets) {
            await tx.printer.updateMany({
              where: {
                store_id: storeId,
                role: target.role,
                is_default: true,
                deleted_at: null,
                id: { not: target.id },
              },
              data: { is_default: false },
            })
          }
          return tx.printer.update({
            where: { id, store_id: storeId, deleted_at: null },
            data: { ...data },
            select: PRINTER_SELECT,
          })
        })
        updated = mapRecordToEntity(row)
      } else {
        updated = await repository.update(id, storeId, data)
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError("Impresora no encontrada")
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("Ya existe una impresora con ese nombre en esta tienda")
      }
      throw err
    }

    return mapEntityToResponse(updated)
  },

  delete: async (id: string, storeId: string): Promise<void> => {
    const existing = await repository.findById(id, storeId)
    if (!existing) throw new NotFoundError("Impresora no encontrada")

    const sameRoleOthers = (await repository.findByStore(storeId)).filter(
      (p) => p.role === existing.role && p.id !== existing.id && p.is_active
    )

    if (sameRoleOthers.length === 0) {
      throw new ConflictError(
        `Esta es la única impresora activa del rol '${existing.role}'. Agregá otra antes de borrar esta.`
      )
    }

    if (existing.is_default) {
      throw new ConflictError(
        `Esta es la impresora predeterminada del rol '${existing.role}'. Marcá otra como predeterminada antes de borrarla.`
      )
    }

    await repository.softDelete(id, storeId)
  },

  setAsDefault: async (id: string, storeId: string, role: PrinterRole): Promise<IPrinterResponse> => {
    const existing = await repository.findById(id, storeId)
    if (!existing) throw new NotFoundError("Impresora no encontrada")

    if (existing.role !== "both" && existing.role !== role) {
      throw new BadRequestError(
        `La impresora tiene rol '${existing.role}' y no puede ser predeterminada del rol '${role}'`
      )
    }

    const clearTargets: Array<{ role: PrinterRole }> =
      role === "both"
        ? [{ role: "receipt" }, { role: "kitchen" }, { role: "both" }]
        : role === "receipt"
          ? [{ role: "receipt" }, { role: "both" }]
          : [{ role: "kitchen" }, { role: "both" }]

    const row = await prisma.$transaction(async (tx) => {
      for (const target of clearTargets) {
        await tx.printer.updateMany({
          where: {
            store_id: storeId,
            role: target.role,
            is_default: true,
            deleted_at: null,
            id: { not: id },
          },
          data: { is_default: false },
        })
      }
      return tx.printer.update({
        where: { id, store_id: storeId, deleted_at: null },
        data: { is_default: true },
        select: PRINTER_SELECT,
      })
    })

    return mapEntityToResponse(mapRecordToEntity(row))
  },
})
