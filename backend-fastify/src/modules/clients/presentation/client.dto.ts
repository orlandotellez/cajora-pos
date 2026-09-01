import { z } from "zod"

export const CreateClientDtoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
})

export const UpdateClientDtoSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

export const ClientQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const ClientPhoneQuerySchema = z.object({
  phone: z.string().min(1),
})

export const BulkDeleteClientsDtoSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one client is required").max(500, "Maximum 500 clients per deletion"),
})

export type CreateClientDto = z.infer<typeof CreateClientDtoSchema>
export type UpdateClientDto = z.infer<typeof UpdateClientDtoSchema>
export type ClientQueryDto = z.infer<typeof ClientQuerySchema>
