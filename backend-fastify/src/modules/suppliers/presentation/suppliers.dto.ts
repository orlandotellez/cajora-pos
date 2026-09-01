import { z } from "zod"

export const CreateSupplierDtoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
})

export const UpdateSupplierDtoSchema = z.object({
  name: z.string().min(1).optional(),
  contact_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

export const SupplierQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const BulkDeleteSuppliersDtoSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one supplier is required").max(500, "Maximum 500 suppliers per deletion"),
})

export type CreateSupplierDto = z.infer<typeof CreateSupplierDtoSchema>
export type UpdateSupplierDto = z.infer<typeof UpdateSupplierDtoSchema>
export type SupplierQueryDto = z.infer<typeof SupplierQuerySchema>
