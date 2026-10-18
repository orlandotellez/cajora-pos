import { z } from "zod"

export const CheckoutSubscriptionDtoSchema = z.object({
  return_url: z.string().url(),
  cancel_url: z.string().url(),
})

export const ActivateSubscriptionDtoSchema = z.object({
  paypal_subscription_id: z.string().min(1),
})

/** Respuesta del intent de checkout embebido de Whop (plan público + referencia firmada). */
export const WhopIntentDtoSchema = z.object({
  planId: z.string(),
  ref: z.string(),
  provider: z.literal("whop"),
})

export type CheckoutSubscriptionDto = z.infer<typeof CheckoutSubscriptionDtoSchema>
export type ActivateSubscriptionDto = z.infer<typeof ActivateSubscriptionDtoSchema>
export type WhopIntentDto = z.infer<typeof WhopIntentDtoSchema>
