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

/**
 * Respuesta de suscripción (misma forma para `GET /mine` y las acciones que la
 * devuelven). No lleva `z.infer` en el servicio: es solo el contrato de la API que
 * documenta Swagger.
 */
export const SubscriptionResponseDtoSchema = z.object({
  mode: z.enum(["cloud", "self_hosted"]),
  plan: z.enum(["monthly", "annual"]),
  status: z.enum(["pending", "active", "past_due", "canceled", "expired"]),
  provider: z.enum(["paypal", "whop"]),
  paypal_subscription_id: z.string().nullable(),
  whop_membership_id: z.string().nullable(),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  grace_ends_at: z.string().nullable(),
  days_overdue: z.number().nullable(),
})

export type CheckoutSubscriptionDto = z.infer<typeof CheckoutSubscriptionDtoSchema>
export type ActivateSubscriptionDto = z.infer<typeof ActivateSubscriptionDtoSchema>
export type WhopIntentDto = z.infer<typeof WhopIntentDtoSchema>
