import { api } from "./client";

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  unit_type?: string | null;
  unit_quantity?: number | null;
  note?: string;
  user_id: string;
  batch_id?: string;
  created_at: string;
}

export interface MovementListResponse {
  movements: InventoryMovement[];
  total: number;
  page: number;
  limit: number;
}

export interface LowStockProduct {
  product_id: string;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
}

export interface LowStockResponse {
  products: LowStockProduct[];
}

export interface BatchItemResponse {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
}

export interface BatchResponse {
  id: string;
  movement_type: string;
  supplier_id?: string | null;
  supplier_name?: string;
  notes?: string | null;
  user_id: string;
  user_name?: string;
  items?: BatchItemResponse[];
  total_items: number;
  total_quantity: number;
  created_at: string;
}

export interface BatchListResponse {
  batches: BatchResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateMovementPayload {
  product_id: string;
  movement_type: "entrada" | "salida" | "ajuste";
  quantity: number;
  /** Costo por unidad (solo entradas/compras) */
  unit_cost?: number;
  /** Si es true, registra la compra como salida de efectivo de la caja abierta */
  paid_cash?: boolean;
  note?: string;
}

export interface CreateBatchItemPayload {
  product_id: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
}

export interface CreateBatchPayload {
  movement_type: "entrada" | "salida" | "ajuste";
  supplier_id?: string | null;
  notes?: string | null;
  /** Registra el total de la compra como salida de efectivo de la caja abierta */
  paid_cash?: boolean;
  items: CreateBatchItemPayload[];
}

export const inventoryApi = {
  list: (params?: {
    product_id?: string;
    movement_type?: string;
    page?: number;
    limit?: number;
  }) => api.get<MovementListResponse>("/inventory", params as Record<string, string | number | boolean | undefined>),

  getByProduct: (productId: string) =>
    api.get<InventoryMovement[]>(`/inventory/product/${productId}`),

  create: (data: CreateMovementPayload) =>
    api.post<InventoryMovement>("/inventory", data),

  lowStock: () =>
    api.get<LowStockResponse>("/inventory/low-stock"),

  batchList: (params?: {
    movement_type?: string;
    supplier_id?: string;
    page?: number;
    limit?: number;
  }) => api.get<BatchListResponse>("/inventory/batches", params as Record<string, string | number | boolean | undefined>),

  batchGetById: (id: string) =>
    api.get<BatchResponse>(`/inventory/batches/${id}`),

  batchCreate: (data: CreateBatchPayload) =>
    api.post<BatchResponse>("/inventory/batches", data),
};
