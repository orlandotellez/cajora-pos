# 05 · Products — Productos

> ❌ **Pendiente en Rust** (módulo `features/products/` no existe).
> ✅ Implementado como referencia en `backend-fastify/src/modules/products/`.

CRUD del catálogo de productos. Permite búsqueda rápida por barcode (escáner POS), filtros por categoría, stock bajo, y soft-delete.

## Tabla de endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/products` | Sí | Lista paginada con filtros. |
| GET | `/products/:id` | Sí | Detalle con `category` y `supplier` resumidos. |
| GET | `/products/barcode/:barcode` | Sí | Búsqueda exacta por código de barras. |
| POST | `/products` | Sí | Crea un producto (valida barcode único). |
| PUT | `/products/:id` | Sí | Actualización parcial. Soporta `null` para desenlazar category/supplier. |
| DELETE | `/products/:id` | Sí | Soft-delete. |

---

## GET `/api/v1/products`

- **Auth**: Sí + StoreGuard.

### Query params

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `search` | string | — | Busca en `name` y `barcode` (contains). |
| `category_id` | uuid | — | Filtra productos de la categoría. |
| `active` | bool | — | Filtra `active=true/false`. |
| `low_stock` | bool | — | Filtra `stock <= low_stock_threshold`. |
| `out_of_stock` | bool | — | Filtra `stock = 0`. |
| `page` | int | 1 | 1-based. |
| `limit` | int | 20 | max 100. |

### Response 200

```json
{
  "products": [
    {
      "id": "uuid",
      "barcode": "7501234567890",
      "name": "Coca-Cola 600ml",
      "unit_type": "unidad",
      "unit_quantity": 1,
      "category": { "id": "uuid", "name": "Bebidas" },
      "supplier": { "id": "uuid", "name": "Coca-Cola FEMSA" },
      "price": 25.0,
      "cost": 18.0,
      "stock": 100,
      "low_stock_threshold": 10,
      "active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 213,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## GET `/api/v1/products/:id`

- **Auth**: Sí + StoreGuard.

### Response 200

Shape `IProductResponse` (ver arriba). Si está soft-deleted, **404**.

---

## GET `/api/v1/products/barcode/:barcode`

- **Auth**: Sí + StoreGuard.
- **Uso**: el POS scanner emite el barcode y agrega al carrito.

### Path params

- `barcode`: string (el valor exacto).

### Response 200

Shape `IProductResponse` o **404** `{ "message": "Product not found" }`.

---

## POST `/api/v1/products`

- **Auth**: Sí + StoreGuard.

### Request body

```json
{
  "barcode": "7501234567890",
  "name": "Coca-Cola 600ml",
  "unit_type": "unidad",
  "unit_quantity": 1,
  "category_id": "uuid",
  "supplier_id": "uuid",
  "price": 25.0,
  "cost": 18.0,
  "stock": 100,
  "low_stock_threshold": 10,
  "active": true
}
```

### Validaciones

| Campo | Reglas |
|---|---|
| `name` | required. |
| `barcode` | opcional; si presente, UNIQUE por tienda. |
| `unit_type` | enum opcional: `unidad \| paquete \| caja \| bolsa \| botella \| lata \| sobre \| barra \| rollo \| galon \| ristra`. |
| `unit_quantity` | int positivo. |
| `category_id` | opcional; FK a `categories.id` (de la tienda). |
| `supplier_id` | opcional; FK a `suppliers.id`. |
| `price` | positivo (>0). |
| `cost` | default 0. |
| `stock` | default 0. |
| `low_stock_threshold` | default 5. |
| `active` | default true. |

### Errores comunes

- `400 Validación fallida`.
- `409 Conflict` — barcode duplicado en esta tienda.

---

## PUT `/api/v1/products/:id`

- **Auth**: Sí + StoreGuard.

### Behavior clave: desvincular category/supplier

```json
// Desenlazar (Fastify: pasar null)
PUT /api/v1/products/<id>
{ "category_id": null, "supplier_id": null }
```

En `Create` (POST): un string vacío se omite (`undefined`); no se ejecuta update.
En `Update` (PUT): un string vacío se traduce a `null`, lo que el backend interpreta como "desenlazar".

> **Esta lógica** vive en el **frontend** (`frontend/src/pages/Products.tsx`) usando:
>
> ```ts
> const emptyToNull = !isNew;
> const valueOr = (v: string) => v || (emptyToNull ? null : undefined);
> ```

### Validaciones

- `name`: si presente, min 1 char.
- `barcode`: si cambia, validar unicidad.
- `price`: positivo.
- `unit_type`: enum. `unit_quantity`: positivo.
- `category_id` / `supplier_id`: `null` (desenlazar) o string UUID válido.

### Errores comunes

- `400`, `404`, `409` (barcode duplicado).

---

## DELETE `/api/v1/products/:id`

- **Auth**: Sí + StoreGuard.
- **Soft-delete**: setea `products.deleted_at = now()`.

### Response 200

```json
{ "message": "Product deleted successfully" }
```

### Side effects

- El producto **ya no aparece** en `GET /products` ni en `GET /sales` (las ventas previas mantienen su `product_name` snapshot en `sale_items`).
- Su stock ya no es fuente de movimientos.

---

## Multi-tenancy

Todas las queries filtran por `store_id`. **No se puede** acceder a productos de otra tienda aunque conozca el `id`.

---

## Detail de implementación

### `domain/entities.rs`

```rust
#[derive(Debug, Serialize, FromRow)]
pub struct Product {
    pub id: Uuid,
    pub barcode: Option<String>,
    pub name: String,
    pub unit_type: Option<String>,
    pub unit_quantity: Option<i32>,
    pub category_id: Option<Uuid>,
    pub supplier_id: Option<Uuid>,
    pub price: Decimal,
    pub cost: Decimal,
    pub stock: i32,
    pub low_stock_threshold: i32,
    pub active: bool,
    pub store_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
```

### Repository methods (signature)

```rust
pub trait ProductRepository {
    async fn find_all(&self, params: ListProductsParams) -> Result<ProductListResult, AppError>;
    async fn find_by_id(&self, id: Uuid, store_id: Uuid) -> Result<Option<Product>, AppError>;
    async fn find_by_barcode(&self, barcode: &str, store_id: Uuid) -> Result<Option<Product>, AppError>;
    async fn create(&self, data: CreateProductData, store_id: Uuid) -> Result<Product, AppError>;
    async fn update(&self, id: Uuid, data: UpdateProductData, store_id: Uuid) -> Result<Product, AppError>;
    async fn soft_delete(&self, id: Uuid, store_id: Uuid) -> Result<(), AppError>;
    async fn update_stock(&self, id: Uuid, delta: i32) -> Result<(), AppError>;
}
```

### Queries sqlx highlights

```sql
-- list with filters
SELECT p.*, c.id as c_id, c.name as c_name, s.id as s_id, s.name as s_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN suppliers  s ON s.id = p.supplier_id
WHERE p.deleted_at IS NULL
  AND p.store_id = $1
  AND ($2::text IS NULL OR (p.name ILIKE '%' || $2 || '%' OR p.barcode = $2))
  AND ($3::uuid IS NULL OR p.category_id = $3)
  AND ($4::bool IS NULL OR p.active = $4)
  AND ($5::bool IS NULL OR p.stock <= p.low_stock_threshold)
ORDER BY p.name ASC
LIMIT $6 OFFSET $7
```

---

## Checklist de migración

| Tarea | Archivo destino |
|---|---|
| `features/products/domain/entities.rs` | Producto + Response. |
| `features/products/domain/contracts/product_repository.rs` | Trait. |
| `features/products/application/product_service.rs` | list/get/getByBarcode/create/update/delete. |
| `features/products/presentation/dto/{request,response}.rs` | CreateProductRequest con `derive(Validate)`. |
| `features/products/presentation/handlers/product_handler.rs` | 5+ handlers. |
| `features/products/infrastructure/sqlx/product_repository.rs` | List, get, getByBarcode, create, update, softDelete. |
| `features/products/infrastructure/mapper.rs` | Product → ProductResponse. |
| Registrar en `features/mod.rs` + `routes/mod.rs` | `nest("/api/v1/products", ...)`. |
| **Decidir**: ¿reutilizar `CategoryRepository` desde aquí o mover a `categories/`? | Recomendado: mover cuando sea necesario. |
