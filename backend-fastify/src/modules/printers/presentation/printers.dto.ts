import { z } from "zod"
import { PRINTER_PROFILE } from "@prisma/client"

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/

const baseFields = {
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  role: z.enum(["receipt", "kitchen", "both"]),
  paper_width: z.union([z.literal(58), z.literal(80)]),
  profile: z.nativeEnum(PRINTER_PROFILE).default("escpos"),
  codepage: z.string().min(1).default("ISO-8859-1"),
  auto_cut: z.boolean().default(true),
  cut_type: z.enum(["full", "partial"]).nullable().optional(),
  open_cash_drawer: z.boolean().default(false),
  default_copies: z.number().int().min(1).max(10).default(1),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
}

const baseObject = z.object(baseFields)

const netVariant = baseObject.extend({
  connection_type: z.literal("net"),
  address: z.string().regex(IPV4_REGEX, "Dirección IP inválida"),
  port: z.number().int().min(1).max(65535),
})

const usbVariant = baseObject.extend({
  connection_type: z.literal("usb"),
  address: z.string().min(1, "Seleccioná un dispositivo USB"),
  port: z.null().optional(),
})

const bluetoothVariant = baseObject.extend({
  connection_type: z.literal("bluetooth"),
  address: z.string().min(1, "Seleccioná un dispositivo Bluetooth"),
  port: z.null().optional(),
})

const crossRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (data: any) => data.open_cash_drawer !== true || data.role === "receipt" || data.role === "both",
      { message: "El cajón de dinero solo aplica a rol 'Recibo' o 'Ambas'", path: ["open_cash_drawer"] }
    )
    .refine(
      (data: any) => data.cut_type == null || data.auto_cut === true,
      { message: "El tipo de corte solo aplica si el corte automático está activado", path: ["cut_type"] }
    )

export const CreatePrinterDtoSchema = crossRules(
  z.discriminatedUnion("connection_type", [netVariant, usbVariant, bluetoothVariant])
)

export type CreatePrinterDto = z.infer<typeof CreatePrinterDtoSchema>

export const UpdatePrinterDtoSchema = crossRules(
  baseObject.extend({
    connection_type: z.enum(["net", "usb", "bluetooth"]).optional(),
    address: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional().nullable(),
  }).partial(),
)

export type UpdatePrinterDto = z.infer<typeof UpdatePrinterDtoSchema>

export const SetDefaultPrinterDtoSchema = z.object({
  role: z.enum(["receipt", "kitchen", "both"]),
})

export type SetDefaultPrinterDto = z.infer<typeof SetDefaultPrinterDtoSchema>

export const TestPrintDtoSchema = z.object({
  copies: z.number().int().min(1).max(5).optional().default(1),
})

export type TestPrintDto = z.infer<typeof TestPrintDtoSchema>

export const PrintReceiptDtoSchema = z.object({
  sale_id: z.string().uuid("ID de venta inválido"),
  copies: z.number().int().min(1).max(5).optional().default(1),
  currency: z.string().optional().default("NIO"),
})

export type PrintReceiptDto = z.infer<typeof PrintReceiptDtoSchema>

export const SendTcpDtoSchema = z.object({
  ticket_base64: z.string().min(1, "Los datos del ticket son obligatorios"),
  address: z.string().min(1, "La dirección IP es obligatoria"),
  port: z.number().int().min(1).max(65535),
})

export type SendTcpDto = z.infer<typeof SendTcpDtoSchema>

export const PrinterIdParamSchema = z.object({
  id: z.string().uuid("ID de impresora inválido"),
})

export type PrinterIdParam = z.infer<typeof PrinterIdParamSchema>
