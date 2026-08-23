import { api } from "./client";

export interface SuperAdminStats {
  stores: { total: number; created_this_month: number };
  users: { total: number; admins: number; cashiers: number; super_admins: number };
  products: { total: number; active: number; low_stock: number };
  sales: { total: number; today: number; this_month: number };
}

export interface SuperAdminStoreRow {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  created_at: string;
  users_count: number;
  products_count: number;
  services_count: number;
}

export interface SuperAdminStoreUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  role: string;
  is_owner: boolean;
  phone?: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SubscriptionHealthSummary {
  total: number
  active: number
  past_due: number
  canceled: number
  expired: number
  pending: number
  cloud_total: number
  self_hosted_total: number
}

export interface SubscriptionHealthStore {
  store_id: string
  store_name: string
  owner_name: string | null
  owner_email: string | null
  status: string
  plan: string
  mode: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  last_event_action: string | null
  last_event_at: string | null
  days_until_expiry: number | null
}

export interface SubscriptionHealthEvent {
  id: string
  store_id: string | null
  store_name: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  action: string
  paypal_subscription_id: string | null
  metadata: unknown
  created_at: string
}

export interface SubscriptionHealthResponse {
  summary: SubscriptionHealthSummary
  problem_stores: SubscriptionHealthStore[]
  recent_events: SubscriptionHealthEvent[]
}

export interface SubscriptionRow {
  id: string
  store_id: string
  store_name: string
  owner_name: string | null
  owner_email: string | null
  mode: string
  plan: string
  status: string
  paypal_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  days_until_expiry: number | null
  created_at: string
  updated_at: string
}

export interface SubscriptionsListResponse {
  subscriptions: SubscriptionRow[]
  total: number
}

export const superAdminApi = {
  getStats: () => api.get<SuperAdminStats>("/super-admin/stats"),

  getStores: () => api.get<{ stores: SuperAdminStoreRow[]; total: number }>("/super-admin/stores"),

  getStoreUsers: (storeId: string) =>
    api.get<{ users: SuperAdminStoreUser[]; total: number }>(`/super-admin/stores/${storeId}/users`),

  getSubscriptionHealth: () =>
    api.get<SubscriptionHealthResponse>("/super-admin/subscription-health"),

  getSubscriptionsList: (params?: { status?: string; mode?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.mode) qs.set("mode", params.mode);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return api.get<SubscriptionsListResponse>(`/super-admin/subscriptions-list${q ? `?${q}` : ""}`);
  },

  updateSubscriptionStatus: (storeId: string, status: string) =>
    api.patch<{ id: string; store_id: string; status: string; updated_at: string }>(
      `/super-admin/subscriptions/${storeId}/status`,
      { status },
    ),
};
