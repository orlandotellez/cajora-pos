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
  phone?: string | null;
  created_at: string;
  deleted_at: string | null;
}

export const superAdminApi = {
  getStats: () => api.get<SuperAdminStats>("/super-admin/stats"),

  getStores: () => api.get<{ stores: SuperAdminStoreRow[]; total: number }>("/super-admin/stores"),

  getStoreUsers: (storeId: string) =>
    api.get<{ users: SuperAdminStoreUser[]; total: number }>(`/super-admin/stores/${storeId}/users`),
};
