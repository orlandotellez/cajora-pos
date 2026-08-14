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
