import { z } from "zod"

export const CreateMovementDtoSchema = z.object({
  product_id: z.string().uuid(),
  movement_type: z.enum(["entrada", "salida", "ajuste"]),
  quantity: z
    .number()
    .int()
    .refine((q) => q !== 0, { message: "La cantidad no puede ser 0" }),
  unit_cost: z.number().positive().max(99_999_999).optional(),
  paid_cash: z.boolean().optional(),
  note: z.string().optional(),
  batch_id: z.string().uuid().optional(),
})

export const MovementQuerySchema = z.object({
  product_id: z.string().uuid().optional(),
  movement_type: z.enum(["entrada", "salida", "ajuste", "venta"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type CreateMovementDto = z.infer<typeof CreateMovementDtoSchema>
export type MovementQueryDto = z.infer<typeof MovementQuerySchema>
