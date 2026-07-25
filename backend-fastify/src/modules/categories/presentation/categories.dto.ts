import { z } from "zod"

export const CreateCategoryDtoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
})

export const UpdateCategoryDtoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
})

export const CategoryQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type CreateCategoryDto = z.infer<typeof CreateCategoryDtoSchema>
export type UpdateCategoryDto = z.infer<typeof UpdateCategoryDtoSchema>
export type CategoryQueryDto = z.infer<typeof CategoryQuerySchema>
