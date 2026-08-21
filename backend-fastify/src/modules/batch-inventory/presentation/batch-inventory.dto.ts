import { z } from "zod"

export const BatchItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit_cost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const CreateBatchDtoSchema = z.object({
  movement_type: z.enum(["entrada", "salida", "ajuste"]),
  supplier_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  paid_cash: z.boolean().optional(),
  items: z.array(BatchItemSchema).min(1, "At least one item is required"),
})

export const BatchQuerySchema = z.object({
  movement_type: z.enum(["entrada", "salida", "ajuste"]).optional(),
  supplier_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type CreateBatchDto = z.infer<typeof CreateBatchDtoSchema>
export type BatchQueryDto = z.infer<typeof BatchQuerySchema>
