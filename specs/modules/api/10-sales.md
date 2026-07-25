# 10 · Sales — Ventas (POS) — ⚠️ Feature más compleja

> ❌ **Pendiente en Rust**.
> ✅ Fastify en `backend-fastify/src/modules/sales/`.

Feature **más crítica** del sistema. Registra ventas con productos, servicios, combos, y descuenta stock automáticamente. Incluye reportes agregados.

## ⚠️ IMPORTANTE — `payment_method` NO es enum SQL real

El campo `sales.payment_method` en PostgreSQL es **`TEXT NOT NULL`** (no un `CREATE TYPE payment_method AS ENUM (...)`). El `enum` viven solo en:
- **App-side (Rust)**: `validator` o **enum de Rust** en el DTO.
- **App-side (Fastify)**: `z.enum([...])` en `sales.dto.ts`.

**Valores soportados por validación**:

| Valor | Estado |
|---|---|
| `efectivo` | ✅ |
| `tarjeta` | ✅ |
| `transferencia` | ✅ |
| `credito` | ✅ (en Zod enum Fastify; ⚠️ el comentario SQL en `schema.prisma` solo lista 3 — fuente-de-verdad conflictiva) |

> 🆘 **Decisión para el port a Rust**: crear `CREATE TYPE payment_method AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'credito')` en una nueva migración sqlx, y migrar el existing column `sales.payment_method` a ese type via `ALTER TABLE`. Esto unifica la validación.

## Tabla de endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/sales` | Sí | Lista paginada con filtros. |
| GET | `/sales/:id` | Sí | Detalle completo (items + service_items con sus productos). |
| POST | `/sales` | Sí | Registra venta completa (valida stock, descuenta, persiste todo en tx). |
| GET | `/sales/report` | Sí | Reporte agregado (totales, top productos, ventas por método). |
| GET | `/sales/revenue-trend` | Sí | Serie temporal de ingresos por día/semana/mes. |

---

## GET `/api/v1/sales`

- **Auth**: Sí + StoreGuard.

### Query params

| Param | Default | Notas |
|---|---|---|
| `start_date` | — | ISO `YYYY-MM-DD`. |
| `end_date` | — | ISO `YYYY-MM-DD`. |
| `user_id` | — | Filtra por cajero. |
| `payment_method` | — | enum válido de los 4 valores. |
| `page` | 1 | — |
| `limit` | 50 | max 100. |

### Response 200

```json
{
  "sales": [
    {
      "id": "uuid",
      "subtotal": 220.0,
      "discount": 0,
      "total": 220.0,
      "payment_method": "efectivo",
      "amount_received": 300.0,
      "change_given": 44.8,
      "user_id": "uuid",
      "created_at": "...",
      "items": [
        {
          "id": "uuid",
          "product_id": "uuid",
          "product_name": "Coca-Cola 600ml",
          "quantity": 2,
          "unit_price": 25.0,
          "line_total": 50.0
        }
      ],
      "service_items": []
    }
  ],
  "total": 312,
  "page": 1,
  "limit": 50,
  "hasMore": true
}
```

> ⚠️ El listado **incluye** los `items` por venta (no es un detalle lazy). Esto lo hace pesado con páginas grandes. Decidir si omitir en el list y dejar solo en `GET /sales/:id`.

---

## GET `/api/v1/sales/:id`

Shape `ISaleResponse` (arriba), completo con items + service_items anidados.

---

## POST `/api/v1/sales` — endpoint principal ⚠️

- **Auth**: Sí + StoreGuard.

### Request body

```json
{
  "subtotal": 255.2,
  "discount": 0,
  "total": 255.2,
  "payment_method": "efectivo",
  "amount_received": 300.0,
  "change_given": 44.8,
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Coca-Cola 600ml",
      "quantity": 2,
      "unit_price": 25.0,
      "line_total": 50.0
    },
    {
      "product_id": "uuid2",
      "product_name": "Tortas de Harina 100g",
      "quantity": 10,
      "unit_price": 17.0
      "line_total": 170.0
    }
  ],
  "service_items": [
    {
      "service_id": "uuid",
      "service_name": "Combo Familiar",
      "base_price": 95.0,
      "line_total": 95.0,
      "products": [
        {
          "product_id": "uuid3",
          "product_name": "Pan dulce",
          "quantity": 1,
          "unit_price": 8.0,
          "line_total": 8.0,
          "affects_price": false
        }
      ]
    }
  ]
}
```

### Validaciones

| Campo | Reglas |
|---|---|
| `payment_method` | uno de: `efectivo`, `tarjeta`, `transferencia`, `credito`. |
| `subtotal`, `total`, `discount` | numéricos ≥ 0. `total` ≥ 0. |
| `amount_received` | opcional, positivo. Requerido si `payment_method === 'efectivo'` para calcular cambio. |
| `items` y/o `service_items` | mindestens uno no vacío (refinamiento Zod/Rust: `items.len() > 0 || service_items.len() > 0`). |
| `items[].product_id`, `quantity > 0`, `unit_price > 0`, `line_total ≥ 0`. | |
| `service_items[].id`, `quantity`, `line_total` | igual. `products[]` opcional. |

### Side effects (todo en transacción SQL — único endpoint crítico del backend)

Flujo del service (Fastify port):

1. **Combinar productos para validación de stock** (línea crítica):

```rust
// Mapa para validar stock: combina items regulares + items de servicio
let mut validation_map: HashMap<Uuid, { name, quantity_to_deduct, current_stock }> = HashMap::new();

// 1. Sumar items regulares
for item in &data.items {
    let db_prod = sqlx::query_as!(Product, "SELECT name, stock FROM products WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL", item.product_id, store_id)
        .fetch_optional(&mut *tx).await?
        .ok_or(AppError::NotFound(format!("Product {} not found", item.product_id)))?;
    let entry = validation_map.entry(item.product_id).or_insert((db_prod.name, 0, db_prod.stock));
    entry.1 += item.quantity;
}

// 2a. Sumar service items con productos custom
for si in &data.service_items {
  if let Some(products) = &si.products {
    for sp in products {
      // load product...
      // entry.1 += sp.quantity
      // track for deduction
    }
  }
}

// 2b. Sumar service items sin productos custom (auto-lookup de service_products)
for si in &data.service_items_with_no_products {
    let service_products = sqlx::query!("SELECT sp.product_id, sp.quantity, p.stock FROM service_products sp JOIN products p ON sp.product_id = p.id WHERE sp.service_id = $1", si.service_id)
        .fetch_all(&mut *tx).await?;
    for sp in service_products {
        let entry = validation_map.entry(sp.product_id).or_insert((...).0, 0, sp.stock);
        entry.1 += sp.quantity;
        // track service-originating product for deduction
    }
}

// 3. Validar stock suficiente
for (_, info) in &validation_map {
    if info.2 < info.1 {
        return Err(AppError::BadRequest(format!("Insufficient stock for: {} (disponible: {}, requerido: {})", info.0, info.2, info.1)));
    }
}
```

2. **Persistir venta y descontar stock** (en la misma tx):

```sql
-- INSERT sale (con user_id + store_id + totales)
INSERT INTO sales (subtotal, discount, total, payment_method,
                   amount_received, change_given, user_id, store_id)
VALUES (...)
RETURNING id;

-- INSERT sale_items[] (cada uno con product_name snapshot, line_total)
-- INSERT sale_service[] (por cada service_item)
-- INSERT sale_service_products[] (por cada sp dentro de cada service_item)

-- UPDATE products.stock por cada product_id (solo del validation_map)
-- diferencia: para service-originating products, descontar; para regular items también.
-- ⚠️ Cuidado con double-deduction: si un producto aparece en items regular Y como
-- sp de un service_item, ya está sumado en validation_map; descontar el total una vez.

-- INSERT inventory_movements[] (movement_type='venta', con batch_id opcional)
-- Este paso permite que el stock de la venta quede en el historial.
```

3. **Commit**.

### Errores comunes

- `400 Validación`.
- `404 Product not found`.
- `422 Insufficient stock`.

---

## GET `/api/v1/sales/report`

- **Auth**: Sí + StoreGuard.

### Query params

| Param | Tipo | Notas |
|---|---|---|
| `start_date` | ISO date | inclusivo. |
| `end_date` | ISO date | inclusivo. |
| `storeId` | uuid | autoderivado del JWT, ignorar param. |

### Response 200

```json
{
  "total_sales": 312,  "total_revenue": 78456.20,
  "total_discount": 254.30,
  "average_ticket": 251.46,
  "sales_by_payment_method": {
    "efectivo": { "count": 200, "total": 45000.0 },
    "tarjeta": { "count": 80, "total": 23456.20 },
    "transferencia": { "count": 30, "total": 9000.0 },
    "credito": { "count": 2, "total": 1000.0 }
  },
  "top_products": [
    { "product_name": "Coca-Cola 600ml", "quantity": 312, "revenue": 7800.0 },
    { "product_name": "Sabritas Original", "quantity": 220, "revenue": 4840.0 }
  ]
}
```

> Computado con agregaciones SQL: `SUM(total)`, `AVG(total)`, `GROUP BY payment_method`, `GROUP BY product_id` ordenado por `SUM(line_total)` desc.

---

## GET `/api/v1/sales/revenue-trend`

- **Auth**: Sí + StoreGuard.

### Query params

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `start_date` | date | required | — |
| `end_date` | date | required | — |
| `group_by` | enum | required | `day \| week \| month`. |
| `store_id` | uuid | autoderivado | — |

### Response 200 (shape `IRevenueTrendItem[]`)

```json
[
  { "period": "2026-07-01", "revenue": 1234.50, "count": 12 },
  { "period": "2026-07-02", "revenue": 980.00, "count": 9 },
  { "period": "2026-07-03", "revenue": 1450.75, "count": 15 }
]
```

`period` formato:
- `day`: `YYYY-MM-DD`.
- `week`: `YYYY-Www` (ISO week).
- `month`: `YYYY-MM`.

SQL (postgres):

```sql
SELECT
  date_trunc($3, created_at) AS period,
  SUM(total) AS revenue,
  COUNT(*) AS count
FROM sales
WHERE created_at BETWEEN $1 AND $2 AND store_id = $4
GROUP BY 1
ORDER BY 1 ASC
```

---

## Multi-tenancy

Todas las queries filtradas por `store_id = claims.store_id`.

---

## Side-effects especiales

| Operación | Stock effect | Inventory movement |
|---|---|---|
| `POST /sales` | Descuenta productos vendidos (incluyendo los que vienen de servicios). | Crea filas en `inventory_movements` con `movement_type='venta'`, `batch_id=NULL` (o el batch que originó el stock? **Decidir**). |

---

## Checklist de migración

| Tarea | Archivo destino |
|---|---|
| `features/sales/domain/entities.rs` | Sale + SaleItem + SaleService + SaleServiceProduct. |
| `domain/contracts/sale_repository.rs` | Trait (read operations). |
| `application/sale_service.rs` | `create` con validación de stock + tx. |
| `presentation/dto/{request,response}.rs` | CreateSaleRequest con anidados (sub-zod?). |
| `presentation/handlers/sale_handler.rs` | 5 handlers. |
| `infrastructure/sqlx/sale_repository.rs` | List, getById, getReport, getRevenueTrend (todo SQL agregada). |
| Cross-feature: usar `ProductRepository::update_stock`. |
| `nest("/api/v1/sales", ...)`. |
| **Crítico**: tests de stock double-deduction (mismo producto en item + service_item). |
| **Migración SQL nueva**: `payments_method` a enum SQL real (decidir antes). |

---

## Detalle crítico: tracking de deduplication

> El service de Fastify usa 3 mapas:

| Mapa | Propósito | Decrementa stock? |
|---|---|---|
| `validationMap` | Combina todos los productos que se descuentan (regular + service). | sí |
| `serviceProductMap` | Productos que vienen **solo** de servicios (no regular). | sí |
| `customServiceProducts` | Items de servicio con productos custom, agrupados por `service_id`. | (persiste, no decrementa directo) |

> ⚠️ **CRÍTICO**: NO descontar 2 veces el mismo producto (e.g. Coca vendido en items regular + usado dentro de un service_item). La deduplicación está implícita porque cada `product_id` se suma 1 sola vez en `validationMap`.

---

## Frontend-side (referencia)

El frontend (`frontend/src/pages/Sales.tsx`) usa este endpoint como callback al confirmar la venta. Recién después de un 201 OK limpia el cart y muestra el ticket. Si recibe 422 (stock insuficiente), muestra el error y resaltea el producto problemático en el cart.
