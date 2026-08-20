import { http, HttpResponse, delay } from "msw";
import {
  DEMO_FIXTURES,
  DEMO_USER,
  DEMO_STORE,
  DEMO_ACCESS_TOKEN,
  DEMO_REFRESH_TOKEN,
  DEMO_EMAIL,
  DEMO_PASSWORD,
} from "./fixtures";
import type { AuthResponse } from "@/api/auth";
import type { Product, CreateProductPayload } from "@/api/products";
import type { Category } from "@/api/categories";
import type { Supplier } from "@/api/suppliers";
import type { Service } from "@/api/services";
import type { Sale, CreateSalePayload } from "@/api/sales";
import type { InventoryMovement, CreateMovementPayload, CreateBatchPayload, BatchResponse } from "@/api/inventory";
import type { UserResponse } from "@/api/users";
import type { Printer } from "@/api/printers";
import type { Settings } from "@/api/settings";

// ============================================================================
// Handlers del modo demo.
//
// GARANTÍA: el catch-all final (http.all("*")) responde 404 a CUALQUIER request
// que no tenga handler explícito. Ningún request cruza el Service Worker hacia
// la red real: la base de datos y el backend de producción jamás se tocan.
// ============================================================================

const API = "*/api/v1";

const BOOTSTRAP_CONFIG = {
  current_api_url: "https://cajora-pos-production.up.railway.app/api/v1",
  app_version: "2.0.6",
  apk_url: "https://pub-17156739f1d5412cb62a579bb0ccbc35.r2.dev/versions/apk/pos-system-v2.0.6-universal.apk",
  checkout_url: "https://cajorapos.com/checkout",
};

// ---- helpers ---------------------------------------------------------------

function paginate<T>(items: T[], page = 1, limit = 20): { items: T[]; total: number } {
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total: items.length };
}

function getNumber(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function authResponse(): AuthResponse {
  return {
    message: "Inicio de sesión exitoso",
    user: DEMO_USER,
    store: DEMO_STORE,
    accessToken: DEMO_ACCESS_TOKEN,
    refreshToken: DEMO_REFRESH_TOKEN,
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Estado mutable de la sesión demo (se pierde al recargar: es intencional).
const products = [...DEMO_FIXTURES.products];
const categories = [...DEMO_FIXTURES.categories];
const suppliers = [...DEMO_FIXTURES.suppliers];
const services = [...DEMO_FIXTURES.services];
const sales = [...DEMO_FIXTURES.sales];
const movements = [...DEMO_FIXTURES.movements];
const batches = [...DEMO_FIXTURES.batches];
const users = [...DEMO_FIXTURES.users];
const printers = [...DEMO_FIXTURES.printers];
let settings: Settings = DEMO_FIXTURES.settings;

export const handlers = [
  // ==========================================================================
  // Bootstrap (config-api.json remoto) — se intercepta para que AppBootstrap
  // resuelva directo sin tocar el bucket de R2.
  // ==========================================================================
  http.get("*/config-api.json", async () => {
    await delay(120);
    return HttpResponse.json(BOOTSTRAP_CONFIG);
  }),

  // ==========================================================================
  // Auth
  // ==========================================================================
  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay(450);
    const body = (await request.json()) as { email?: string; password?: string } | null;

    // SOLO se aceptan las credenciales de la demo. Si alguien intenta iniciar
    // con su cuenta real desde una pestaña en modo demo (el worker sigue
    // activo tras un logout), recibe un 401 claro en vez de quedar logueado
    // con la sesión demo sin entender por qué.
    if (body?.email !== DEMO_EMAIL || body?.password !== DEMO_PASSWORD) {
      return HttpResponse.json(
        {
          message:
            "Estás en el modo demo. Para iniciar con tu cuenta real, salí del modo demo: recargá la página sin ?demo=1 en la URL.",
        },
        { status: 401 },
      );
    }

    return HttpResponse.json(authResponse());
  }),

  http.post(`${API}/auth/refresh`, async () => {
    await delay(250);
    return HttpResponse.json(authResponse());
  }),

  http.post(`${API}/auth/logout`, async () => {
    await delay(150);
    return HttpResponse.json({ message: "Sesión cerrada" });
  }),

  // ==========================================================================
  // Products
  // ==========================================================================
  http.get(`${API}/products`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const categoryId = url.searchParams.get("category_id");
    const lowStock = url.searchParams.get("low_stock") === "true";
    const outOfStock = url.searchParams.get("out_of_stock") === "true";
    const active = url.searchParams.get("active");
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);

    let filtered = products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search) && !(p.barcode ?? "").includes(search)) return false;
      if (categoryId && p.category?.id !== categoryId) return false;
      if (lowStock && !(p.stock < p.low_stock_threshold)) return false;
      if (outOfStock && p.stock !== 0) return false;
      if (active !== null && p.active !== (active === "true")) return false;
      return true;
    });
    // Ordenar por nombre para una demo predecible.
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ products: items, total, page, limit });
  }),

  http.get(`${API}/products/barcode/:barcode`, async ({ params }) => {
    await delay(200);
    const product = products.find((p) => p.barcode === params.barcode);
    if (!product) return HttpResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    return HttpResponse.json(product);
  }),

  http.get(`${API}/products/:id`, async ({ params }) => {
    await delay(150);
    const product = products.find((p) => p.id === params.id);
    if (!product) return HttpResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    return HttpResponse.json(product);
  }),

  http.post(`${API}/products`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as CreateProductPayload;
    const product: Product = {
      id: makeId("demo-prod"),
      name: body.name,
      barcode: body.barcode ?? undefined,
      unit_type: body.unit_type ?? undefined,
      unit_quantity: body.unit_quantity ?? undefined,
      category: body.category_id
        ? categories.find((c) => c.id === body.category_id) ?? { id: body.category_id, name: "—" }
        : undefined,
      supplier: null,
      price: body.price ?? 0,
      cost: body.cost ?? 0,
      stock: body.stock ?? 0,
      low_stock_threshold: body.low_stock_threshold ?? 10,
      active: body.active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    products.unshift(product);
    return HttpResponse.json(product, { status: 201 });
  }),

  http.put(`${API}/products/:id`, async ({ request, params }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Product>;
    const idx = products.findIndex((p) => p.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    products[idx] = { ...products[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(products[idx]);
  }),

  http.delete(`${API}/products/:id`, async ({ params }) => {
    await delay(200);
    const idx = products.findIndex((p) => p.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    products.splice(idx, 1);
    return HttpResponse.json({ message: "Producto eliminado" });
  }),

  // ==========================================================================
  // Categories
  // ==========================================================================
  http.get(`${API}/categories`, async () => {
    await delay(150);
    return HttpResponse.json(categories);
  }),

  http.get(`${API}/categories/paginated`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const filtered = categories.filter((c) => !search || c.name.toLowerCase().includes(search));
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ categories: items, total, page, limit });
  }),

  http.post(`${API}/categories`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { name: string; description?: string };
    const category: Category = {
      id: makeId("demo-cat"),
      name: body.name,
      description: body.description ?? null,
      product_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    categories.unshift(category);
    return HttpResponse.json(category, { status: 201 });
  }),

  http.put(`${API}/categories/:id`, async ({ request, params }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Category>;
    const idx = categories.findIndex((c) => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Categoría no encontrada" }, { status: 404 });
    categories[idx] = { ...categories[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(categories[idx]);
  }),

  http.delete(`${API}/categories/:id`, async ({ params }) => {
    await delay(200);
    const idx = categories.findIndex((c) => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Categoría no encontrada" }, { status: 404 });
    categories.splice(idx, 1);
    return HttpResponse.json({ message: "Categoría eliminada" });
  }),

  // ==========================================================================
  // Suppliers
  // ==========================================================================
  http.get(`${API}/suppliers`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const filtered = suppliers.filter(
      (s) => !search || s.name.toLowerCase().includes(search) || (s.contact_name ?? "").toLowerCase().includes(search),
    );
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ suppliers: items, total, page, limit });
  }),

  http.post(`${API}/suppliers`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Supplier> & { name: string };
    const supplier: Supplier = {
      id: makeId("demo-prov"),
      name: body.name,
      contact_name: body.contact_name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      notes: body.notes,
      is_active: body.is_active ?? true,
      product_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    suppliers.unshift(supplier);
    return HttpResponse.json(supplier, { status: 201 });
  }),

  http.put(`${API}/suppliers/:id`, async ({ request, params }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Supplier>;
    const idx = suppliers.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Proveedor no encontrado" }, { status: 404 });
    suppliers[idx] = { ...suppliers[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(suppliers[idx]);
  }),

  http.delete(`${API}/suppliers/:id`, async ({ params }) => {
    await delay(200);
    const idx = suppliers.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Proveedor no encontrado" }, { status: 404 });
    suppliers.splice(idx, 1);
    return HttpResponse.json({ message: "Proveedor eliminado" });
  }),

  // ==========================================================================
  // Services
  // ==========================================================================
  http.get(`${API}/services`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const filtered = services.filter((s) => !search || s.name.toLowerCase().includes(search));
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ services: items, total, page, limit });
  }),

  http.post(`${API}/services`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Service> & { name: string };
    const service: Service = {
      id: makeId("demo-svc"),
      name: body.name,
      description: body.description,
      base_price: body.base_price ?? 0,
      is_active: body.is_active ?? true,
      products: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    services.unshift(service);
    return HttpResponse.json(service, { status: 201 });
  }),

  http.put(`${API}/services/:id`, async ({ request, params }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Service>;
    const idx = services.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Servicio no encontrado" }, { status: 404 });
    services[idx] = { ...services[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(services[idx]);
  }),

  http.delete(`${API}/services/:id`, async ({ params }) => {
    await delay(200);
    const idx = services.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Servicio no encontrado" }, { status: 404 });
    services.splice(idx, 1);
    return HttpResponse.json({ message: "Servicio eliminado" });
  }),

  // ==========================================================================
  // Sales
  // ==========================================================================
  http.get(`${API}/sales/report`, async ({ request }) => {
    await delay(300);
    void request;
    return HttpResponse.json(DEMO_FIXTURES.saleReport);
  }),

  http.get(`${API}/sales/revenue-trend`, async ({ request }) => {
    await delay(300);
    void request;
    return HttpResponse.json(DEMO_FIXTURES.revenueTrend);
  }),

  http.get(`${API}/sales/revenue-by-hour`, async ({ request }) => {
    await delay(300);
    void request;
    return HttpResponse.json(DEMO_FIXTURES.revenueByHour);
  }),

  http.get(`${API}/sales/revenue-by-category`, async ({ request }) => {
    await delay(300);
    void request;
    return HttpResponse.json(DEMO_FIXTURES.revenueByCategory);
  }),

  http.get(`${API}/sales`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const paymentMethod = url.searchParams.get("payment_method");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);

    let filtered = [...sales].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (q) {
      filtered = filtered.filter(
        (s) => s.id.toLowerCase().includes(q) || s.user_name.toLowerCase().includes(q),
      );
    }
    if (paymentMethod) {
      filtered = filtered.filter((s) => s.payment_method === paymentMethod);
    }
    if (startDate) filtered = filtered.filter((s) => s.created_at >= startDate);
    if (endDate) filtered = filtered.filter((s) => s.created_at <= endDate);

    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ sales: items, total, page, limit });
  }),

  http.post(`${API}/sales`, async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as CreateSalePayload;
    const sale: Sale = {
      id: makeId("demo-sale"),
      subtotal: body.subtotal,
      discount: body.discount,
      total: body.total,
      payment_method: body.payment_method,
      amount_received: body.amount_received,
      change_given: body.change_given,
      user_id: DEMO_USER.id,
      user_name: body.user_name || DEMO_USER.name,
      created_at: new Date().toISOString(),
      items: body.items?.map((it) => ({
        id: makeId("demo-item"),
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
      service_items: body.service_items?.map((si) => ({
        id: makeId("demo-svc-item"),
        service_id: si.service_id,
        service_name: si.service_name,
        base_price: si.base_price,
        line_total: si.line_total,
        products: si.products?.map((p) => ({
          id: makeId("demo-svc-prod"),
          product_id: p.product_id,
          product_name: p.product_name,
          quantity: p.quantity,
          unit_price: p.unit_price,
          line_total: p.line_total,
          affects_price: p.affects_price,
        })) ?? [],
      })) ?? [],
    };
    sales.unshift(sale);
    return HttpResponse.json(sale, { status: 201 });
  }),

  http.get(`${API}/sales/:id`, async ({ params }) => {
    await delay(200);
    const sale = sales.find((s) => s.id === params.id);
    if (!sale) return HttpResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    return HttpResponse.json(sale);
  }),

  // ==========================================================================
  // Inventory
  // ==========================================================================
  http.get(`${API}/inventory`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const movementType = url.searchParams.get("movement_type");
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const filtered = [...movements]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter((m) => !movementType || m.movement_type === movementType);
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ movements: items, total, page, limit });
  }),

  http.get(`${API}/inventory/product/:productId`, async ({ params }) => {
    await delay(200);
    const byProduct = movements
      .filter((m) => m.product_id === params.productId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json(byProduct);
  }),

  http.get(`${API}/inventory/low-stock`, async () => {
    await delay(200);
    return HttpResponse.json({ products: DEMO_FIXTURES.lowStock });
  }),

  http.post(`${API}/inventory`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as CreateMovementPayload;
    const product = products.find((p) => p.id === body.product_id);
    const movement: InventoryMovement = {
      id: makeId("demo-mov"),
      product_id: body.product_id,
      product_name: product?.name,
      movement_type: body.movement_type,
      quantity: body.quantity,
      note: body.note,
      user_id: DEMO_USER.id,
      created_at: new Date().toISOString(),
    };
    movements.unshift(movement);
    return HttpResponse.json(movement, { status: 201 });
  }),

  http.get(`${API}/inventory/batches/:id`, async ({ params }) => {
    await delay(200);
    const batch = batches.find((b) => b.id === params.id);
    if (!batch) return HttpResponse.json({ message: "Lote no encontrado" }, { status: 404 });
    return HttpResponse.json(batch);
  }),

  http.get(`${API}/inventory/batches`, async ({ request }) => {
    await delay(250);
    const url = new URL(request.url);
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const sorted = [...batches].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { items, total } = paginate(sorted, page, limit);
    return HttpResponse.json({ batches: items, total, page, limit });
  }),

  http.post(`${API}/inventory/batches`, async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as CreateBatchPayload;
    const batch: BatchResponse = {
      id: makeId("demo-batch"),
      movement_type: body.movement_type,
      supplier_id: body.supplier_id,
      supplier_name: suppliers.find((s) => s.id === body.supplier_id)?.name,
      notes: body.notes,
      user_id: DEMO_USER.id,
      user_name: DEMO_USER.name,
      items: body.items.map((it) => ({
        id: makeId("demo-batch-item"),
        product_id: it.product_id,
        product_name: products.find((p) => p.id === it.product_id)?.name,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        notes: it.notes,
      })),
      total_items: body.items.length,
      total_quantity: body.items.reduce((acc, it) => acc + it.quantity, 0),
      created_at: new Date().toISOString(),
    };
    batches.unshift(batch);
    return HttpResponse.json(batch, { status: 201 });
  }),

  // ==========================================================================
  // Settings
  // ==========================================================================
  http.get(`${API}/settings`, async () => {
    await delay(150);
    return HttpResponse.json(settings);
  }),

  http.put(`${API}/settings`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Settings>;
    settings = { ...settings, ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(settings);
  }),

  // ==========================================================================
  // Users
  // ==========================================================================
  http.get(`${API}/users`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const page = getNumber(url.searchParams.get("page"), 1);
    const limit = getNumber(url.searchParams.get("limit"), 20);
    const filtered = users.filter(
      (u) => !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
    );
    const { items, total } = paginate(filtered, page, limit);
    return HttpResponse.json({ users: items, total, page, limit });
  }),

  http.post(`${API}/users`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<UserResponse> & { name: string; email: string; role: string };
    const user: UserResponse = {
      id: makeId("demo-user"),
      name: body.name,
      email: body.email,
      email_verified: true,
      role: (body.role as UserResponse["role"]) ?? "cajero",
      phone: body.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.unshift(user);
    return HttpResponse.json(user, { status: 201 });
  }),

  http.put(`${API}/users/:id`, async ({ request, params }) => {
    await delay(200);
    const body = (await request.json()) as Partial<UserResponse>;
    const idx = users.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    users[idx] = { ...users[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(users[idx]);
  }),

  http.delete(`${API}/users/:id`, async ({ params }) => {
    await delay(200);
    const idx = users.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    users.splice(idx, 1);
    return HttpResponse.json({ message: "Usuario eliminado" });
  }),

  // ==========================================================================
  // Subscriptions (siempre activa en la demo: el paywall nunca debe aparecer)
  // ==========================================================================
  http.get(`${API}/subscriptions/mine`, async () => {
    await delay(200);
    return HttpResponse.json(DEMO_FIXTURES.subscription);
  }),

  http.get(`${API}/subscriptions/billing`, async () => {
    await delay(200);
    return HttpResponse.json(DEMO_FIXTURES.billing);
  }),

  http.post(`${API}/subscriptions/cancel`, async () => {
    await delay(250);
    return HttpResponse.json(DEMO_FIXTURES.subscription);
  }),

  http.post(`${API}/subscriptions/reactivate`, async () => {
    await delay(250);
    return HttpResponse.json(DEMO_FIXTURES.subscription);
  }),

  // ==========================================================================
  // Printers (en la demo la impresión física no existe: respuesta honesta)
  // ==========================================================================
  http.get(`${API}/printers`, async () => {
    await delay(200);
    return HttpResponse.json({ printers });
  }),

  http.get(`${API}/printers/:id`, async ({ params }) => {
    await delay(150);
    const printer = printers.find((p) => p.id === params.id);
    if (!printer) return HttpResponse.json({ message: "Impresora no encontrada" }, { status: 404 });
    return HttpResponse.json(printer);
  }),

  http.post(`${API}/printers/:id/set-default`, async ({ params }) => {
    await delay(200);
    const idx = printers.findIndex((p) => p.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Impresora no encontrada" }, { status: 404 });
    printers.forEach((p, i) => {
      printers[i] = { ...p, is_default: p.id === params.id };
    });
    return HttpResponse.json(printers[idx]);
  }),

  http.post(`${API}/printers/:id/test`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: false,
      bytes_sent: 0,
      duration_ms: 0,
      hint: "La impresión no está disponible en la demo",
    });
  }),

  http.post(`${API}/printers/:id/probe`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: false,
      bytes_sent: 0,
      duration_ms: 0,
      hint: "La impresión no está disponible en la demo",
    });
  }),

  http.post(`${API}/printers/:id/print-receipt`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: false,
      bytes_sent: 0,
      duration_ms: 0,
      hint: "La impresión no está disponible en la demo",
    });
  }),

  // ==========================================================================
  // Realtime SSE — stream que solo emite heartbeats. Mantiene la conexión del
  // frontend "viva" (evita reconexiones ruidosas) sin entregar eventos reales.
  // ==========================================================================
  http.get(`${API}/events`, () => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(": demo-connected\n\n"));
        timer = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(": demo-ping\n\n"));
        }, 15_000);
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });
    return new HttpResponse(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),

  // ==========================================================================
  // CATCH-ALL — la garantía estructural: cualquier request sin handler explícito
  // recibe 404 y JAMÁS sale del Service Worker hacia la red real.
  //
  // REGLA: solo se interceptan requests CROSS-ORIGIN (la API en Railway, el
  // bootstrap en R2, o cualquier tercero que la app consulte). Los recursos del
  // MISMO origin (dynamic imports de Vite dev, chunks lazy de producción,
  // estilos, imágenes) pasan de largo: bloquearlos rompería la carga de
  // módulos con "Failed to fetch dynamically imported module".
  // ==========================================================================
  http.all("*", async ({ request }) => {
    if (request.url.startsWith(location.origin)) {
      return undefined; // bypass: la red normal lo resuelve
    }
    await delay(100);
    return HttpResponse.json(
      { message: "Este recurso no está disponible en el modo demo" },
      { status: 404 },
    );
  }),
];