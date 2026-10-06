import { BILLING_MODE, SUBSCRIPTION_STATUS, SUBSCRIPTION_PLAN } from "@prisma/client"

export type BillingMode = (typeof BILLING_MODE)[keyof typeof BILLING_MODE]
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN]

export interface ISubscriptionResponse {
  mode: BillingMode
  plan: SubscriptionPlan
  /** Estado resuelto contra el reloj. Una fila `active` con el período vencido devuelve `expired`. */
  status: SubscriptionStatus
  paypal_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  /** Fin del período pagado + `GRACE_DAYS`. `null` si no hay período registrado. */
  grace_ends_at: string | null
  /** Días vencidos pasado el grace. `0` mientras hay acceso, `null` si no hay período. */
  days_overdue: number | null
}

export interface IBillingPayment {
  id: string
  amount: string
  currency: string
  paid_at: string
}

export interface IBillingResponse {
  payments: IBillingPayment[]
  total_paid: string
  currency: string
  /** Fin del período pagado. `null` cuando ya venció: no hay próxima fecha que anunciar. */
  next_payment_at: string | null
  /** Estado resuelto de la suscripción, para que la UI no vuelva a calcular el vencimiento. */
  status: SubscriptionStatus
  days_overdue: number | null
  /** Fin del período pagado cuando ya venció, para poder decir "venció el X". */
  overdue_since: string | null
}
