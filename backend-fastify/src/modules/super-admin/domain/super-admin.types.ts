export interface IGlobalStats {
  stores: {
    total: number
    created_this_month: number
  }
  users: {
    total: number
    admins: number
    cashiers: number
    super_admins: number
  }
  products: {
    total: number
    active: number
    low_stock: number
  }
  sales: {
    total: number
    today: number
    this_month: number
  }
}

export interface IStoreStatsRow {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: Date
  users_count: number
  products_count: number
  services_count: number
}

export interface IStoresListResponse {
  stores: IStoreStatsRow[]
  total: number
}

export interface IStoreUserRow {
  id: string
  name: string
  email: string
  email_verified: boolean
  role: string
  phone: string | null
  created_at: Date
  deleted_at: Date | null
}

export interface IStoreUsersResponse {
  users: IStoreUserRow[]
  total: number
}

export interface ISubscriptionEventRow {
  id: string
  store_id: string | null
  store_name: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  action: string
  paypal_subscription_id: string | null
  metadata: unknown
  created_at: Date
}

export interface ISubscriptionEventsResponse {
  events: ISubscriptionEventRow[]
  total: number
}

export interface ISubscriptionEventsFilters {
  store_id?: string
  user_id?: string
  action?: string
  from?: string
  to?: string
  limit: number
  offset: number
}

// --- Salud de suscripciones (panel de alertas) ---

export interface ISubscriptionHealthSummary {
  total: number
  active: number
  past_due: number
  canceled: number
  expired: number
  pending: number
  cloud_total: number
  self_hosted_total: number
}

export interface ISubscriptionHealthStore {
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

export interface ISubscriptionHealthResponse {
  summary: ISubscriptionHealthSummary
  problem_stores: ISubscriptionHealthStore[]
  recent_events: ISubscriptionEventRow[]
}
