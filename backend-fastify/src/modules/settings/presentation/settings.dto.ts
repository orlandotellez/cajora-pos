import { z } from "zod"

export const UpdateSettingsDtoSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  low_stock_threshold: z.number().int().min(0).optional(),
  ticket_footer: z.string().optional().nullable(),
})

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsDtoSchema>
