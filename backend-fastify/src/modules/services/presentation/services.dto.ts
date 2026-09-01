import { z } from "zod"

export const ServiceProductDtoSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive("Quantity must be positive"),
})

export const CreateServiceDtoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  base_price: z.number().positive("Base price must be positive"),
  is_active: z.boolean().optional(),
  products: z.array(ServiceProductDtoSchema).optional(),
})

export const UpdateServiceDtoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  base_price: z.number().positive().optional(),
  is_active: z.boolean().optional(),
  products: z.array(ServiceProductDtoSchema).optional(),
})

export const ServiceQuerySchema = z.object({
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const BulkDeleteServicesDtoSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one service is required").max(500, "Maximum 500 services per deletion"),
})

export type CreateServiceDto = z.infer<typeof CreateServiceDtoSchema>
export type UpdateServiceDto = z.infer<typeof UpdateServiceDtoSchema>
export type ServiceQueryDto = z.infer<typeof ServiceQuerySchema>
