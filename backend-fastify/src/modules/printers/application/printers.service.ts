import { Prisma } from "@prisma/client"
import { prisma } from "@/config/prisma"
import { NotFoundError, ConflictError, BadRequestError } from "@/core/errors/AppError"
import type { IPrinterRepository } from "../domain/printers.interface"
import type { IPrinterResponse, PrinterRole, PrinterConnType, PrinterProfile, PrinterActualStatus, PrinterCutType } from "../domain/printers.types"
import type { IPrinterEntity, CreatePrinterData, UpdatePrinterData } from "../domain/printers.entities"
import type { CreatePrinterDto, UpdatePrinterDto } from "../presentation/printers.dto"
import { duplicateForCopies, renderTestTicket, renderCodepageProbe, renderSaleReceipt, resolveCurrencySymbol } from "../infrastructure/escpos/encoder"
import { sendBytesViaTCP } from "../infrastructure/escpos/transport.tcp"
import type { SaleReceiptItem, SaleReceiptService, SaleReceiptServiceProduct } from "../infrastructure/escpos/encoder"

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

  testPrint: async (id: string, storeId: string, copies: number) => {
    const printer = await repository.findById(id, storeId)
    if (!printer) throw new NotFoundError("Impresora no encontrada")

    if (printer.connection_type !== "net") {
      throw new BadRequestError(
        `Por ahora solo se soporta conexión por red (TCP). La impresora es de tipo '${printer.connection_type}'. USB/Bluetooth entran en Fase 6 con Tauri.`
      )
    }

    if (!printer.address || !printer.port) {
      throw new BadRequestError("La impresora no tiene IP o puerto configurado")
    }

    const ticket = renderTestTicket({
      paper_width: (printer.paper_width === 58 ? 58 : 80),
      profile: printer.profile,
      codepage: printer.codepage,
      open_cash_drawer: printer.open_cash_drawer,
      cut_type: printer.cut_type,
      copies,
      store_name: "POS System",
    })

    const allBytes = duplicateForCopies(ticket, copies)
    const ticketBase64 = Buffer.from(allBytes).toString("base64")

    return {
      success: true,
      ticket_base64: ticketBase64,
      ticket_bytes: allBytes.length,
      printer: {
        id: printer.id,
        name: printer.name,
        address: printer.address,
        port: printer.port,
        paper_width: printer.paper_width,
        profile: printer.profile,
        codepage: printer.codepage,
      },
    }
  },

  probePrint: async (id: string, storeId: string) => {
    const printer = await repository.findById(id, storeId)
    if (!printer) throw new NotFoundError("Impresora no encontrada")

    if (printer.connection_type !== "net") {
      throw new BadRequestError(
        `Por ahora solo se soporta conexión por red (TCP). La impresora es de tipo '${printer.connection_type}'.`
      )
    }

    if (!printer.address || !printer.port) {
      throw new BadRequestError("La impresora no tiene IP o puerto configurado")
    }

    const bytes = renderCodepageProbe()
    const ticketBase64 = Buffer.from(bytes).toString("base64")

    return {
      success: true,
      ticket_base64: ticketBase64,
      ticket_bytes: bytes.length,
      printer: {
        id: printer.id,
        name: printer.name,
        address: printer.address,
        port: printer.port,
        paper_width: printer.paper_width,
        profile: printer.profile,
        codepage: printer.codepage,
      },
      indices_tested: Array.from({ length: 41 }, (_, i) => i),
      hint: "Mirá la línea donde aparezca correctamente 'ñ á é í ó ú'. Ese índice es la codepage correcta para tu impresora.",
    }
  },

  sendTcp: async (ticketBase64: string, address: string, port: number) => {
    const bytes = Buffer.from(ticketBase64, "base64")
    return await sendBytesViaTCP(address, port, bytes)
  },

  printReceipt: async (id: string, storeId: string, saleId: string, copies: number, currency: string = "NIO") => {
    const printer = await repository.findById(id, storeId)
    if (!printer) throw new NotFoundError("Impresora no encontrada")

    if (printer.connection_type !== "net") {
      throw new BadRequestError(
        `Por ahora solo se soporta conexión por red (TCP). La impresora es de tipo '${printer.connection_type}'.`
      )
    }

    if (!printer.address || !printer.port) {
      throw new BadRequestError("La impresora no tiene IP o puerto configurado")
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId, store_id: storeId },
      include: {
        items: true,
        service_items: { include: { products: true } },
      },
    })
    if (!sale) throw new NotFoundError("Venta no encontrada")

    const settings = await prisma.settings.findUnique({ where: { store_id: storeId } })

    const items: SaleReceiptItem[] = (sale.items || []).map((i) => ({
      product_name: i.product_name,
      quantity: i.quantity,
      line_total: Number(i.line_total),
    }))

    const service_items: SaleReceiptService[] = (sale.service_items || []).map((si) => ({
      service_name: si.service_name,
      base_price: Number(si.base_price),
      line_total: Number(si.line_total),
      products: (si.products || []).map((sp) => ({
        product_name: sp.product_name,
        quantity: sp.quantity,
        unit_price: Number(sp.unit_price),
        line_total: Number(sp.line_total),
        affects_price: sp.affects_price,
      })),
    }))

    const ticket = renderSaleReceipt(
      {
        paper_width: printer.paper_width === 58 ? 58 : 80,
        profile: printer.profile,
        codepage: printer.codepage,
        open_cash_drawer: printer.open_cash_drawer,
        cut_type: printer.cut_type as "full" | "partial" | null,
      },
      {
        store_name: settings?.name ?? "Mi Negocio",
        store_address: settings?.address ?? null,
        store_phone: settings?.phone ?? null,
        ticket_footer: settings?.ticket_footer ?? null,
        sale_id: sale.id,
        user_name: sale.user_name ?? "",
        created_at: sale.created_at,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        total: Number(sale.total),
        payment_method: sale.payment_method,
        amount_received: sale.amount_received ? Number(sale.amount_received) : null,
        change_given: sale.change_given ? Number(sale.change_given) : null,
        currency_symbol: resolveCurrencySymbol(currency),
        items,
        service_items,
      }
    )

    const allBytes = duplicateForCopies(ticket, copies)
    const ticketBase64 = Buffer.from(allBytes).toString("base64")

    return {
      success: true,
      ticket_base64: ticketBase64,
      ticket_bytes: allBytes.length,
      printer: {
        id: printer.id,
        name: printer.name,
        address: printer.address,
        port: printer.port,
        paper_width: printer.paper_width,
        profile: printer.profile,
        codepage: printer.codepage,
      },
    }
  },
})
