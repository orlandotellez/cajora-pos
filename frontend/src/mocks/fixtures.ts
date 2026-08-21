import type {
  AuthUser,
  Store,
} from "@/api/auth";
import type { Category } from "@/api/categories";
import type { CashSession } from "@/api/cash-register";
import type { InventoryMovement, BatchResponse, LowStockProduct } from "@/api/inventory";
import type { Printer } from "@/api/printers";
import type { Product } from "@/api/products";
import type { Sale, SaleReport, RevenueTrendItem, RevenueByHourItem, RevenueByCategoryItem } from "@/api/sales";
import type { Service } from "@/api/services";
import type { Settings } from "@/api/settings";
import type { SubscriptionBilling, SubscriptionMine } from "@/api/subscriptions";
import type { Supplier } from "@/api/suppliers";
import type { UserResponse } from "@/api/users";

// ============================================================================
// Fixtures del modo demo — datos 100% sintéticos.
// NINGÚN request sale a la red real mientras el worker de MSW esté activo.
// ============================================================================

export const DEMO_ACCESS_TOKEN = "demo-access-token";
export const DEMO_REFRESH_TOKEN = "demo-refresh-token";
export const DEMO_EMAIL = "demo@cajorapos.com";
export const DEMO_PASSWORD = "demo12345";

export const DEMO_USER: AuthUser = {
  id: "demo-user-admin",
  name: "Ana Martínez",
  email: DEMO_EMAIL,
  email_verified: true,
  role: "admin",
  phone: "+505 8888 0000",
  created_at: "2026-01-10T09:00:00.000Z",
  updated_at: "2026-08-19T09:00:00.000Z",
};

export const DEMO_STORE: Store = {
  id: "demo-store-1",
  name: "Mi Tienda Demo",
  address: "Managua, Nicaragua",
  phone: "+505 8888 0000",
};

const DEMO_USERS: UserResponse[] = [
  DEMO_USER,
  {
    id: "demo-user-cashier-1",
    name: "Carlos Ruiz",
    email: "carlos@mitiendademo.com",
    email_verified: true,
    role: "cajero",
    phone: "+505 8888 1111",
    created_at: "2026-02-15T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "demo-user-cashier-2",
    name: "María López",
    email: "maria@mitiendademo.com",
    email_verified: true,
    role: "cajero",
    phone: "+505 8888 2222",
    created_at: "2026-03-02T10:00:00.000Z",
    updated_at: "2026-07-20T10:00:00.000Z",
  },
];

const DEMO_CATEGORIES: Category[] = [
  { id: "demo-cat-bebidas", name: "Bebidas", description: "Gaseosas, agua y jugos", product_count: 3 },
  { id: "demo-cat-snacks", name: "Snacks y Golosinas", description: "Galletas, frituras y dulces", product_count: 2 },
  { id: "demo-cat-lacteos", name: "Lácteos", description: "Leche, quesos y derivados", product_count: 2 },
  { id: "demo-cat-granos", name: "Granos Básicos", description: "Arroz, frijoles, azúcar y aceite", product_count: 4 },
  { id: "demo-cat-limpieza", name: "Limpieza", description: "Detergentes, cloro y papel", product_count: 3 },
];

const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: "demo-prov-1",
    name: "Distribuidora La Colonia",
    contact_name: "José Blandón",
    email: "ventas@lacolonia.com.ni",
    phone: "+505 2255 1000",
    address: "Managua",
    notes: "Pago a 30 días",
    is_active: true,
    product_count: 8,
    created_at: "2026-01-15T09:00:00.000Z",
    updated_at: "2026-07-30T09:00:00.000Z",
  },
  {
    id: "demo-prov-2",
    name: "Agroinsumos del Pacífico",
    contact_name: "Rosa Chamorro",
    email: "pedidos@agroinsumos.com.ni",
    phone: "+505 2278 4500",
    address: "León",
    notes: undefined,
    is_active: true,
    product_count: 4,
    created_at: "2026-02-01T09:00:00.000Z",
    updated_at: "2026-06-15T09:00:00.000Z",
  },
  {
    id: "demo-prov-3",
    name: "Comercial Universal",
    contact_name: "Pedro Tapia",
    email: "info@comercialuniversal.com.ni",
    phone: "+505 2249 3300",
    address: "Masaya",
    notes: "Descuento por volumen",
    is_active: false,
    product_count: 3,
    created_at: "2026-03-10T09:00:00.000Z",
    updated_at: "2026-05-20T09:00:00.000Z",
  },
];

const cat = (id: string, name: string) => ({ id, name });
const prov = (id: string, name: string) => ({ id, name });

const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-prod-1",
    barcode: "7441000000011",
    name: "Coca-Cola 1.5 L",
    unit_type: "unidad",
    category: cat("demo-cat-bebidas", "Bebidas"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 75,
    cost: 62,
    stock: 48,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-01-20T09:00:00.000Z",
    updated_at: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "demo-prod-2",
    barcode: "7441000000028",
    name: "Agua Cristal 1 L",
    unit_type: "unidad",
    category: cat("demo-cat-bebidas", "Bebidas"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 22,
    cost: 16,
    stock: 120,
    low_stock_threshold: 30,
    active: true,
    created_at: "2026-01-20T09:00:00.000Z",
    updated_at: "2026-08-17T09:00:00.000Z",
  },
  {
    id: "demo-prod-3",
    barcode: "7441000000035",
    name: "Café La Vero 200 g",
    unit_type: "unidad",
    category: cat("demo-cat-bebidas", "Bebidas"),
    supplier: prov("demo-prov-2", "Agroinsumos del Pacífico"),
    price: 95,
    cost: 78,
    stock: 30,
    low_stock_threshold: 8,
    active: true,
    created_at: "2026-02-05T09:00:00.000Z",
    updated_at: "2026-08-15T09:00:00.000Z",
  },
  {
    id: "demo-prod-4",
    barcode: "7441000000042",
    name: "Leche Parmalat 1 L",
    unit_type: "unidad",
    category: cat("demo-cat-lacteos", "Lácteos"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 58,
    cost: 50,
    stock: 12,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-01-25T09:00:00.000Z",
    updated_at: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "demo-prod-5",
    barcode: "7441000000059",
    name: "Queso seco 1 lb",
    unit_type: "libra",
    category: cat("demo-cat-lacteos", "Lácteos"),
    supplier: prov("demo-prov-2", "Agroinsumos del Pacífico"),
    price: 90,
    cost: 72,
    stock: 8,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-02-10T09:00:00.000Z",
    updated_at: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "demo-prod-6",
    barcode: "7441000000066",
    name: "Frijoles rojos 1 lb",
    unit_type: "libra",
    category: cat("demo-cat-granos", "Granos Básicos"),
    supplier: prov("demo-prov-2", "Agroinsumos del Pacífico"),
    price: 32,
    cost: 24,
    stock: 75,
    low_stock_threshold: 20,
    active: true,
    created_at: "2026-01-30T09:00:00.000Z",
    updated_at: "2026-08-16T09:00:00.000Z",
  },
  {
    id: "demo-prod-7",
    barcode: "7441000000073",
    name: "Arroz 1 lb",
    unit_type: "libra",
    category: cat("demo-cat-granos", "Granos Básicos"),
    supplier: prov("demo-prov-2", "Agroinsumos del Pacífico"),
    price: 20,
    cost: 15,
    stock: 150,
    low_stock_threshold: 40,
    active: true,
    created_at: "2026-01-30T09:00:00.000Z",
    updated_at: "2026-08-16T09:00:00.000Z",
  },
  {
    id: "demo-prod-8",
    barcode: "7441000000080",
    name: "Aceite 1 L",
    unit_type: "unidad",
    category: cat("demo-cat-granos", "Granos Básicos"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 85,
    cost: 70,
    stock: 22,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-02-20T09:00:00.000Z",
    updated_at: "2026-08-14T09:00:00.000Z",
  },
  {
    id: "demo-prod-9",
    barcode: "7441000000097",
    name: "Azúcar 1 lb",
    unit_type: "libra",
    category: cat("demo-cat-granos", "Granos Básicos"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 18,
    cost: 13,
    stock: 90,
    low_stock_threshold: 25,
    active: true,
    created_at: "2026-02-20T09:00:00.000Z",
    updated_at: "2026-08-14T09:00:00.000Z",
  },
  {
    id: "demo-prod-10",
    barcode: "7441000000103",
    name: "Galletas Emperador",
    unit_type: "unidad",
    category: cat("demo-cat-snacks", "Snacks y Golosinas"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 25,
    cost: 19,
    stock: 64,
    low_stock_threshold: 20,
    active: true,
    created_at: "2026-03-05T09:00:00.000Z",
    updated_at: "2026-08-13T09:00:00.000Z",
  },
  {
    id: "demo-prod-11",
    barcode: "7441000000110",
    name: "Doritos 60 g",
    unit_type: "unidad",
    category: cat("demo-cat-snacks", "Snacks y Golosinas"),
    supplier: prov("demo-prov-3", "Comercial Universal"),
    price: 28,
    cost: 21,
    stock: 5,
    low_stock_threshold: 15,
    active: true,
    created_at: "2026-03-05T09:00:00.000Z",
    updated_at: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "demo-prod-12",
    barcode: "7441000000127",
    name: "Detergente Ariel 1 kg",
    unit_type: "unidad",
    category: cat("demo-cat-limpieza", "Limpieza"),
    supplier: prov("demo-prov-3", "Comercial Universal"),
    price: 110,
    cost: 92,
    stock: 18,
    low_stock_threshold: 8,
    active: true,
    created_at: "2026-03-15T09:00:00.000Z",
    updated_at: "2026-08-11T09:00:00.000Z",
  },
  {
    id: "demo-prod-13",
    barcode: "7441000000134",
    name: "Jabón de baño",
    unit_type: "unidad",
    category: cat("demo-cat-limpieza", "Limpieza"),
    supplier: prov("demo-prov-3", "Comercial Universal"),
    price: 20,
    cost: 14,
    stock: 40,
    low_stock_threshold: 12,
    active: true,
    created_at: "2026-03-15T09:00:00.000Z",
    updated_at: "2026-08-10T09:00:00.000Z",
  },
  {
    id: "demo-prod-14",
    barcode: "7441000000141",
    name: "Cloro 1 L",
    unit_type: "unidad",
    category: cat("demo-cat-limpieza", "Limpieza"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 25,
    cost: 18,
    stock: 33,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-08-09T09:00:00.000Z",
  },
  {
    id: "demo-prod-15",
    barcode: "7441000000158",
    name: "Papel higiénico x4",
    unit_type: "unidad",
    category: cat("demo-cat-limpieza", "Limpieza"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 65,
    cost: 52,
    stock: 0,
    low_stock_threshold: 10,
    active: true,
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-08-08T09:00:00.000Z",
  },
  {
    id: "demo-prod-16",
    barcode: "7441000000165",
    name: "Cerveza Toña 12 oz",
    unit_type: "unidad",
    category: cat("demo-cat-bebidas", "Bebidas"),
    supplier: prov("demo-prov-1", "Distribuidora La Colonia"),
    price: 40,
    cost: 32,
    stock: 55,
    low_stock_threshold: 20,
    active: true,
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-08-07T09:00:00.000Z",
  },
];

const DEMO_SERVICES: Service[] = [
  {
    id: "demo-svc-1",
    name: "Envío a domicilio",
    description: "Entrega local dentro de Managua",
    base_price: 40,
    is_active: true,
    products: [],
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "demo-svc-2",
    name: "Recarga de celular",
    description: "Recarga para todas las operadoras",
    base_price: 100,
    is_active: true,
    products: [],
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "demo-svc-3",
    name: "Fotocopias",
    description: "Fotocopia blanco y negro por página",
    base_price: 3,
    is_active: false,
    products: [],
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
];

// Helper para construir ventas demo con items consistentes.
function makeSale(
  id: string,
  date: string,
  userName: string,
  userId: string,
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "credito",
  items: { productId: string; name: string; qty: number; price: number }[],
  discount = 0,
): Sale {
  const saleItems = items.map((it) => ({
    id: `${id}-item-${it.productId}`,
    product_id: it.productId,
    product_name: it.name,
    quantity: it.qty,
    unit_price: it.price,
    line_total: it.qty * it.price,
  }));
  const subtotal = saleItems.reduce((acc, i) => acc + i.line_total, 0);
  const total = subtotal - discount;
  return {
    id,
    subtotal,
    discount,
    total,
    payment_method: paymentMethod,
    amount_received: paymentMethod === "efectivo" ? Math.ceil(total / 10) * 10 : total,
    change_given: paymentMethod === "efectivo" ? Math.ceil(total / 10) * 10 - total : 0,
    user_id: userId,
    user_name: userName,
    created_at: date,
    items: saleItems,
  };
}

const DEMO_SALES: Sale[] = [
  makeSale(
    "demo-sale-1",
    "2026-08-19T09:24:00.000Z",
    "Ana Martínez",
    DEMO_USER.id,
    "efectivo",
    [
      { productId: "demo-prod-1", name: "Coca-Cola 1.5 L", qty: 2, price: 75 },
      { productId: "demo-prod-10", name: "Galletas Emperador", qty: 3, price: 25 },
      { productId: "demo-prod-7", name: "Arroz 1 lb", qty: 5, price: 20 },
    ],
  ),
  makeSale(
    "demo-sale-2",
    "2026-08-19T10:05:00.000Z",
    "Carlos Ruiz",
    "demo-user-cashier-1",
    "tarjeta",
    [
      { productId: "demo-prod-12", name: "Detergente Ariel 1 kg", qty: 1, price: 110 },
      { productId: "demo-prod-14", name: "Cloro 1 L", qty: 2, price: 25 },
    ],
  ),
  makeSale(
    "demo-sale-3",
    "2026-08-18T15:40:00.000Z",
    "María López",
    "demo-user-cashier-2",
    "efectivo",
    [
      { productId: "demo-prod-6", name: "Frijoles rojos 1 lb", qty: 4, price: 32 },
      { productId: "demo-prod-8", name: "Aceite 1 L", qty: 2, price: 85 },
      { productId: "demo-prod-9", name: "Azúcar 1 lb", qty: 3, price: 18 },
    ],
    15,
  ),
  makeSale(
    "demo-sale-4",
    "2026-08-18T11:12:00.000Z",
    "Ana Martínez",
    DEMO_USER.id,
    "transferencia",
    [
      { productId: "demo-prod-4", name: "Leche Parmalat 1 L", qty: 6, price: 58 },
      { productId: "demo-prod-5", name: "Queso seco 1 lb", qty: 2, price: 90 },
    ],
  ),
  makeSale(
    "demo-sale-5",
    "2026-08-17T17:55:00.000Z",
    "Carlos Ruiz",
    "demo-user-cashier-1",
    "efectivo",
    [
      { productId: "demo-prod-16", name: "Cerveza Toña 12 oz", qty: 6, price: 40 },
      { productId: "demo-prod-11", name: "Doritos 60 g", qty: 4, price: 28 },
    ],
  ),
  makeSale(
    "demo-sale-6",
    "2026-08-17T08:30:00.000Z",
    "María López",
    "demo-user-cashier-2",
    "efectivo",
    [
      { productId: "demo-prod-2", name: "Agua Cristal 1 L", qty: 12, price: 22 },
      { productId: "demo-prod-3", name: "Café La Vero 200 g", qty: 2, price: 95 },
    ],
  ),
  makeSale(
    "demo-sale-7",
    "2026-08-16T13:20:00.000Z",
    "Ana Martínez",
    DEMO_USER.id,
    "credito",
    [
      { productId: "demo-prod-1", name: "Coca-Cola 1.5 L", qty: 5, price: 75 },
      { productId: "demo-prod-7", name: "Arroz 1 lb", qty: 10, price: 20 },
      { productId: "demo-prod-6", name: "Frijoles rojos 1 lb", qty: 8, price: 32 },
    ],
    25,
  ),
  makeSale(
    "demo-sale-8",
    "2026-08-15T16:45:00.000Z",
    "Carlos Ruiz",
    "demo-user-cashier-1",
    "tarjeta",
    [
      { productId: "demo-prod-13", name: "Jabón de baño", qty: 3, price: 20 },
      { productId: "demo-prod-15", name: "Papel higiénico x4", qty: 2, price: 65 },
    ],
  ),
  makeSale(
    "demo-sale-9",
    "2026-08-14T10:10:00.000Z",
    "María López",
    "demo-user-cashier-2",
    "efectivo",
    [
      { productId: "demo-prod-4", name: "Leche Parmalat 1 L", qty: 4, price: 58 },
      { productId: "demo-prod-10", name: "Galletas Emperador", qty: 6, price: 25 },
      { productId: "demo-prod-2", name: "Agua Cristal 1 L", qty: 4, price: 22 },
    ],
  ),
  makeSale(
    "demo-sale-10",
    "2026-08-13T09:50:00.000Z",
    "Ana Martínez",
    DEMO_USER.id,
    "efectivo",
    [
      { productId: "demo-prod-8", name: "Aceite 1 L", qty: 3, price: 85 },
      { productId: "demo-prod-9", name: "Azúcar 1 lb", qty: 5, price: 18 },
      { productId: "demo-prod-12", name: "Detergente Ariel 1 kg", qty: 2, price: 110 },
    ],
    10,
  ),
];

const DEMO_MOVEMENTS: InventoryMovement[] = [
  {
    id: "demo-mov-1",
    product_id: "demo-prod-7",
    product_name: "Arroz 1 lb",
    movement_type: "entrada",
    quantity: 50,
    note: "Compra a Distribuidora La Colonia",
    user_id: DEMO_USER.id,
    batch_id: "demo-batch-1",
    created_at: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "demo-mov-2",
    product_id: "demo-prod-5",
    product_name: "Queso seco 1 lb",
    movement_type: "salida",
    quantity: 6,
    note: "Venta del día",
    user_id: "demo-user-cashier-1",
    created_at: "2026-08-18T11:12:00.000Z",
  },
  {
    id: "demo-mov-3",
    product_id: "demo-prod-15",
    product_name: "Papel higiénico x4",
    movement_type: "salida",
    quantity: 2,
    note: "Venta del día",
    user_id: "demo-user-cashier-1",
    created_at: "2026-08-15T16:45:00.000Z",
  },
  {
    id: "demo-mov-4",
    product_id: "demo-prod-16",
    product_name: "Cerveza Toña 12 oz",
    movement_type: "entrada",
    quantity: 30,
    note: "Reposición de stock",
    user_id: DEMO_USER.id,
    batch_id: "demo-batch-2",
    created_at: "2026-08-14T09:00:00.000Z",
  },
  {
    id: "demo-mov-5",
    product_id: "demo-prod-11",
    product_name: "Doritos 60 g",
    movement_type: "ajuste",
    quantity: -3,
    note: "Ajuste por merma",
    user_id: DEMO_USER.id,
    created_at: "2026-08-13T09:00:00.000Z",
  },
  {
    id: "demo-mov-6",
    product_id: "demo-prod-4",
    product_name: "Leche Parmalat 1 L",
    movement_type: "entrada",
    quantity: 24,
    note: "Compra semanal",
    user_id: DEMO_USER.id,
    batch_id: "demo-batch-1",
    created_at: "2026-08-12T09:00:00.000Z",
  },
];

const DEMO_BATCHES: BatchResponse[] = [
  {
    id: "demo-batch-1",
    movement_type: "entrada",
    supplier_id: "demo-prov-1",
    supplier_name: "Distribuidora La Colonia",
    notes: "Compra quincenal",
    user_id: DEMO_USER.id,
    user_name: "Ana Martínez",
    items: [
      { id: "demo-batch-1-item-1", product_id: "demo-prod-7", product_name: "Arroz 1 lb", quantity: 50, unit_cost: 15 },
      { id: "demo-batch-1-item-2", product_id: "demo-prod-4", product_name: "Leche Parmalat 1 L", quantity: 24, unit_cost: 50 },
    ],
    total_items: 2,
    total_quantity: 74,
    created_at: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "demo-batch-2",
    movement_type: "entrada",
    supplier_id: "demo-prov-1",
    supplier_name: "Distribuidora La Colonia",
    notes: "Reposición bebidas",
    user_id: DEMO_USER.id,
    user_name: "Ana Martínez",
    items: [
      { id: "demo-batch-2-item-1", product_id: "demo-prod-16", product_name: "Cerveza Toña 12 oz", quantity: 30, unit_cost: 32 },
    ],
    total_items: 1,
    total_quantity: 30,
    created_at: "2026-08-14T09:00:00.000Z",
  },
];

const DEMO_SETTINGS: Settings = {
  id: 1,
  name: "Mi Tienda Demo",
  address: "Managua, Nicaragua",
  phone: "+505 8888 0000",
  low_stock_threshold: 10,
  ticket_footer: "¡Gracias por su compra!",
  updated_at: "2026-08-01T09:00:00.000Z",
};

const DEMO_SUBSCRIPTION: SubscriptionMine = {
  mode: "cloud",
  plan: "monthly",
  status: "active",
  paypal_subscription_id: "I-DEMO1234567890",
  current_period_start: "2026-08-10T00:00:00.000Z",
  current_period_end: "2026-09-09T00:00:00.000Z",
  cancel_at_period_end: false,
};

const DEMO_BILLING: SubscriptionBilling = {
  payments: [
    { id: "demo-pay-1", amount: "15.99", currency: "USD", paid_at: "2026-08-10T00:00:00.000Z" },
    { id: "demo-pay-2", amount: "15.99", currency: "USD", paid_at: "2026-07-10T00:00:00.000Z" },
    { id: "demo-pay-3", amount: "15.99", currency: "USD", paid_at: "2026-06-10T00:00:00.000Z" },
  ],
  total_paid: "47.97",
  currency: "USD",
  next_payment_at: "2026-09-10T00:00:00.000Z",
};

const DEMO_PRINTERS: Printer[] = [
  {
    id: "demo-printer-1",
    store_id: DEMO_STORE.id,
    name: "Epson TM-T20II (Local)",
    connection_type: "net",
    address: "192.168.1.50",
    port: 9100,
    paper_width: 80,
    profile: "escpos",
    codepage: "cp437",
    auto_cut: true,
    cut_type: "full",
    open_cash_drawer: true,
    default_copies: 1,
    role: "receipt",
    is_default: true,
    is_active: true,
    last_status: "online",
    last_seen_at: "2026-08-19T09:00:00.000Z",
    created_at: "2026-01-20T09:00:00.000Z",
    updated_at: "2026-08-01T09:00:00.000Z",
  },
];

const DEMO_LOW_STOCK: LowStockProduct[] = [
  { product_id: "demo-prod-5", product_name: "Queso seco 1 lb", current_stock: 8, low_stock_threshold: 10, is_low_stock: true },
  { product_id: "demo-prod-11", product_name: "Doritos 60 g", current_stock: 5, low_stock_threshold: 15, is_low_stock: true },
  { product_id: "demo-prod-15", product_name: "Papel higiénico x4", current_stock: 0, low_stock_threshold: 10, is_low_stock: true },
];

const DEMO_SALE_REPORT: SaleReport = {
  total_sales: 64,
  total_revenue: 21180,
  total_discount: 50,
  average_ticket: 330.9,
  sales_by_payment_method: {
    efectivo: 38,
    tarjeta: 12,
    transferencia: 8,
    credito: 6,
  },
  top_products: [
    { product_name: "Arroz 1 lb", quantity: 25, revenue: 500 },
    { product_name: "Coca-Cola 1.5 L", quantity: 22, revenue: 1650 },
    { product_name: "Frijoles rojos 1 lb", quantity: 18, revenue: 576 },
    { product_name: "Agua Cristal 1 L", quantity: 16, revenue: 352 },
    { product_name: "Leche Parmalat 1 L", quantity: 14, revenue: 812 },
  ],
};

function isoDaysAgo(days: number, hour = 12): string {
  const d = new Date("2026-08-19T00:00:00.000Z");
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const DEMO_REVENUE_TREND: RevenueTrendItem[] = Array.from({ length: 14 }, (_, i) => {
  const daysAgo = 13 - i;
  const base = 900 + ((i * 137) % 1400);
  return { date: isoDaysAgo(daysAgo), revenue: base };
});

const DEMO_REVENUE_BY_HOUR: RevenueByHourItem[] = [
  { hour: 8, revenue: 850, sales: 3 },
  { hour: 9, revenue: 1200, sales: 5 },
  { hour: 10, revenue: 1600, sales: 7 },
  { hour: 11, revenue: 2100, sales: 9 },
  { hour: 12, revenue: 2800, sales: 11 },
  { hour: 13, revenue: 1900, sales: 8 },
  { hour: 14, revenue: 1500, sales: 6 },
  { hour: 15, revenue: 1750, sales: 7 },
  { hour: 16, revenue: 2300, sales: 9 },
  { hour: 17, revenue: 2600, sales: 10 },
  { hour: 18, revenue: 1900, sales: 7 },
  { hour: 19, revenue: 1100, sales: 4 },
];

const DEMO_REVENUE_BY_CATEGORY: RevenueByCategoryItem[] = [
  { category_name: "Bebidas", revenue: 6740, quantity: 52 },
  { category_name: "Granos Básicos", revenue: 5840, quantity: 68 },
  { category_name: "Lácteos", revenue: 3210, quantity: 28 },
  { category_name: "Limpieza", revenue: 2940, quantity: 22 },
  { category_name: "Snacks y Golosinas", revenue: 2450, quantity: 34 },
];

// Sesiones de caja para el módulo Apertura/Cierre. Arranca con una sesión
// abierta del usuario demo (para que el flujo de cierre sea probable) y dos
// cierres históricos (uno cuadrado, uno con faltante).
const DEMO_CASH_SESSIONS: CashSession[] = [
  {
    id: "demo-cash-open-1",
    store_id: DEMO_STORE.id,
    user_id: DEMO_USER.id,
    user_name: DEMO_USER.name,
    label: "Caja 1",
    status: "abierto",
    opening_amount: 1000,
    opened_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-cash-closed-2",
    store_id: DEMO_STORE.id,
    user_id: "demo-user-cashier-1",
    user_name: "Carlos Ruiz",
    label: "Caja 1",
    status: "cerrado",
    opening_amount: 800,
    closing_amount_counted: 3250,
    expected_amount: 3300,
    difference: -50,
    observations: "Faltante reportado, se revisa mañana",
    opened_at: "2026-08-18T13:00:00.000Z",
    closed_at: "2026-08-18T20:05:00.000Z",
  },
  {
    id: "demo-cash-closed-1",
    store_id: DEMO_STORE.id,
    user_id: DEMO_USER.id,
    user_name: DEMO_USER.name,
    label: "Caja 1",
    status: "cerrado",
    opening_amount: 500,
    closing_amount_counted: 4120.5,
    expected_amount: 4120.5,
    difference: 0,
    opened_at: "2026-08-17T08:00:00.000Z",
    closed_at: "2026-08-17T19:30:00.000Z",
  },
];

export interface DemoCashExpense {
  id: string;
  session_id: string;
  amount: number;
  reason: string;
  description?: string;
  source_type?: string;
  ref_id?: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

// Gastos de caja demo: una compra de inventario pagada en efectivo hoy.
const DEMO_CASH_EXPENSES: DemoCashExpense[] = [
  {
    id: "demo-cash-exp-1",
    session_id: "demo-cash-open-1",
    amount: 450,
    reason: "compra_inventario",
    description: "Compra: Azúcar x25",
    source_type: "inventory_movement",
    ref_id: "demo-mov-exp-1",
    user_id: DEMO_USER.id,
    user_name: DEMO_USER.name,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_FIXTURES = {
  users: DEMO_USERS,
  categories: DEMO_CATEGORIES,
  suppliers: DEMO_SUPPLIERS,
  products: DEMO_PRODUCTS,
  services: DEMO_SERVICES,
  sales: DEMO_SALES,
  movements: DEMO_MOVEMENTS,
  batches: DEMO_BATCHES,
  settings: DEMO_SETTINGS,
  subscription: DEMO_SUBSCRIPTION,
  billing: DEMO_BILLING,
  printers: DEMO_PRINTERS,
  lowStock: DEMO_LOW_STOCK,
  saleReport: DEMO_SALE_REPORT,
  revenueTrend: DEMO_REVENUE_TREND,
  revenueByHour: DEMO_REVENUE_BY_HOUR,
  revenueByCategory: DEMO_REVENUE_BY_CATEGORY,
  cashSessions: DEMO_CASH_SESSIONS,
  cashExpenses: DEMO_CASH_EXPENSES,
};