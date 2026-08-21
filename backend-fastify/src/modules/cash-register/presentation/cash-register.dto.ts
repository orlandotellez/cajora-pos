import { z } from "zod"

export const OpenCashSessionDtoSchema = z.object({
  monto_inicial: z.number().nonnegative(),
  // El nombre de la caja es obligatorio: toda sesión se clasifica.
  label: z.string().trim().min(1, "El nombre de la caja es obligatorio").max(50),
})

export const CloseCashSessionDtoSchema = z.object({
  session_id: z.string().uuid(),
  monto_contado: z.number().nonnegative(),
  observaciones: z.string().trim().max(500).optional(),
})

export const CashHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type OpenCashSessionDto = z.infer<typeof OpenCashSessionDtoSchema>
export type CloseCashSessionDto = z.infer<typeof CloseCashSessionDtoSchema>
