import { api } from "./client";

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface SaleServiceProduct {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  affects_price?: boolean;
}

export interface SaleServiceItem {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  line_total: number;
  products: SaleServiceProduct[];
}

export interface Sale {
  id: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_received?: number;
  change_given?: number;
  user_id: string;
  user_name: string;
  created_at: string;
  items?: SaleItem[];
  service_items?: SaleServiceItem[];
}

export interface SaleListResponse {
  sales: Sale[];
  total: number;
  page: number;
  limit: number;
}

export interface SaleReport {
  total_sales: number;
  total_revenue: number;
  total_discount: number;
  average_ticket: number;
  sales_by_payment_method: Record<string, number>;
  top_products: { product_name: string; quantity: number; revenue: number }[];
}

export interface RevenueTrendItem {
  date: string;
  revenue: number;
}

export interface CreateSaleItemPayload {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CreateSaleServiceItemProductPayload {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  affects_price?: boolean;
}

export interface CreateSaleServiceItemPayload {
  service_id: string;
  service_name: string;
  base_price: number;
  line_total: number;
  products?: CreateSaleServiceItemProductPayload[];
}

export interface CreateSalePayload {
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "credito";
  amount_received?: number;
  change_given?: number;
  user_name: string;
  items?: CreateSaleItemPayload[];
  service_items?: CreateSaleServiceItemPayload[];
}

export const salesApi = {
  list: (params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    payment_method?: string;
    page?: number;
    limit?: number;
  }) => api.get<SaleListResponse>("/sales", params as Record<string, string | number | boolean | undefined>),

  getById: (id: string) =>
    api.get<Sale>(`/sales/${id}`),

  create: (data: CreateSalePayload) =>
    api.post<Sale>("/sales", data),

  report: (params?: { start_date?: string; end_date?: string }) =>
    api.get<SaleReport>("/sales/report", params as Record<string, string | number | boolean | undefined>),

  revenueTrend: (params: { start_date: string; end_date: string; group_by: "day" | "week" | "month" }) =>
    api.get<RevenueTrendItem[]>("/sales/revenue-trend", params as Record<string, string | number | boolean | undefined>),
};
