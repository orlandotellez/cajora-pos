import { z } from "zod"

export const CheckoutSubscriptionDtoSchema = z.object({
  return_url: z.string().url(),
  cancel_url: z.string().url(),
})

export const ActivateSubscriptionDtoSchema = z.object({
  paypal_subscription_id: z.string().min(1),
})

export type CheckoutSubscriptionDto = z.infer<typeof CheckoutSubscriptionDtoSchema>
export type ActivateSubscriptionDto = z.infer<typeof ActivateSubscriptionDtoSchema>
