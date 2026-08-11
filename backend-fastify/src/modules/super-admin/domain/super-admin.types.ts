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
