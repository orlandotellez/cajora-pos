import { api } from "./client";

export type SubscriptionStatus = "pending" | "active" | "past_due" | "canceled" | "expired";
export type SubscriptionMode = "cloud" | "self_hosted";

export interface SubscriptionMine {
  mode: SubscriptionMode;
  plan: "monthly";
  status: SubscriptionStatus;
  paypal_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface BillingPayment {
  id: string;
  amount: string;
  currency: string;
  paid_at: string;
}

export interface SubscriptionBilling {
  payments: BillingPayment[];
  total_paid: string;
  currency: string;
  next_payment_at: string | null;
}

export const subscriptionsApi = {
  mine: () => api.get<SubscriptionMine>("/subscriptions/mine"),

  billing: () => api.get<SubscriptionBilling>("/subscriptions/billing"),

  /** Cancela al final del período (self-serve). */
  cancel: () => api.post<SubscriptionMine>("/subscriptions/cancel"),

  /** Reabre el flujo de pago: deja la suscripción en pending hasta pagar. */
  reactivate: () => api.post<SubscriptionMine>("/subscriptions/reactivate"),
};