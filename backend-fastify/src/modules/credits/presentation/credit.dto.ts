import { z } from "zod"

export const RegisterPaymentDtoSchema = z.object({
  sale_id: z.string().uuid(),
  client_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia"]),
  notes: z.string().optional(),
})

export type RegisterPaymentDto = z.infer<typeof RegisterPaymentDtoSchema>
