# Full Schema — POS System

Vista consolidada de todas las tablas del POS System con su propósito y la columna principal.

> El DDL completo está en: `backend-rust/src/database/migrations/20260629234600_full_schema.sql`.

## Tablas (resumen)

| # | Tabla | Columna principal | Propósito |
|---|---|---|---|
| 01 | `stores` | `name` | Tenancy unit. Cada negocio es una tienda. |
| 02 | `users` | `email` (UNIQUE por store) | Usuarios (admin / cajero). |
| 03 | `accounts` | `password` (hash) | Credenciales + proveedores OAuth (futuro). |
| 04 | `sessions` | `token` | Refresh tokens activos (rotación real). |
| 05 | `verifications` | `identifier` + `value` | Códigos de verificación (email, reset). |
| 06 | `categories` | `name` (UNIQUE por store) | Categorías de producto. |
| 07 | `suppliers` | `name` | Proveedores. |
| 08 | `products` | `barcode` (UNIQUE por store) | Catálogo de productos. |
| 09 | `service_products` | cantidad | Composición de un `service`. |
| 10 | `services` | `base_price` | Servicios compuestos (combos). |
| 11 | `sales` | `total` | Venta cabecera. |
| 12 | `sale_items` | `line_total` | Items regulares vendidos. |
| 13 | `sale_services` | `line_total` | Services vendidos. |
| 14 | `sale_service_products` | `quantity` | Productos consumidos dentro de cada service vendido. |
| 15 | `inventory_batches` | `movement_type` | Batch inventory cabecera. |
| 16 | `inventory_batch_items` | `quantity` | Items del batch. |
| 17 | `inventory_movements` | `movement_type` | Cada movimiento individual (también para ventas). |
| 18 | `settings` | UNIQUE `store_id` | Configuración + impresora. |

## Multi-tenancy

- Columna `store_id UUID` (FK a `stores.id`) en: `users`, `products`, `categories`, `suppliers`, `services`, `sales`, `inventory_movements`, `inventory_batches`, `settings`.
- Cada query filtra por `store_id` del usuario autenticado (claim del JWT).
- `settings.store_id` UNIQUE.

## Soft-delete

Columna `deleted_at TIMESTAMPTZ NULL` en: `users`, `categories`, `suppliers`, `products`, `services`. Las ventas/items NO se borraban nunca (trazabilidad).

## Decimal money

`DECIMAL(10,2)` para `price`, `cost`, `subtotal`, `total`, `discount`, `amount_received`, `change_given`, `base_price`, `unit_cost`. Nunca `FLOAT`.

## UUIDs

PKs son `UUID DEFAULT uuid_generate_v4()` (en Postgres moderno: `gen_random_uuid()` provisto por `pgcrypto` o `uuid-ossp`). La migración actual usa `UUID NOT NULL` sin default — son generadas por el cliente (Rust o Prisma).

## Decisión sobre migraciones aplicadas

| Tabla | Cuando se creó |
|---|---|
| Stores, users, accounts, sessions, verification, products, categories, suppliers, services, sales, sale_items, inventory_* | migration `20260625204131_init/init.sql` |
| `sale_services` y `sale_service_products` para soportar items de servicio en ventas | migration `20260709010306_add_multi_tenant/migration.sql` (o equivalente en Prisma history) |
| Campos de impresora en `settings` | migration `20260709033600_add_printer_settings/migration.sql` |

> ⚠️ El repositorio Fastify tiene `prisma/migrations/`. El repositorio Rust tiene UN solo archivo `20260629234600_full_schema.sql` que consolida todas las anteriores. Ambos producen el mismo estado final de DB. Para mantenimiento: preferir migraciones incrementales en Rust (sqlx migrate add).

## Dump visual

```
┌─────────┐      ┌──────┐
│ stores  │◄─────┤ users │
└─────────┘      └──────┘
   ▲                ▲
   │                │
   │                ├──────┐
   │                │accounts
   │                └──────┘
   │                ▲
   │                │
   │           ┌────┴────┐
   │           │sessions │
   │           └─────────┘
   │
   ├──────────┐
   │settings  │ UNIQUE on store_id
   └──────────┘
   │
   ├──────┐  ┌──────────┐  ┌──────────┐
   │products│ │categories│  │suppliers │
   └──┬───┘  └──────────┘  └────┬─────┘
      │                          │
      │         ┌────────────────┘
      │         │
   ┌──▼─────────▼──┐
   │service_products│
   └──────┬─────────┘
          │ (composición)
   ┌──────▼───────┐
   │  services    │
   └──────────────┘

sales ──► sale_items ► products
  │
  └──► sale_services ──► services
              └──► sale_service_products ──► products

inventory_batches ──► inventory_batch_items ► products
                ──► inventory_movements ──► products
```

## Diagrama mental de mutación de stock

| Operación | `products.stock` | `inventory_movements` |
|---|---|---|
| `POST /inventory` (entrada/salida/ajuste) | ±delta | INSERT (1 row) |
| `POST /inventory/batches` | ±delta por product del batch | INSERT n rows (1 por product) |
| `POST /sales` | -delta por product vendido (+service_products consumidos) | INSERT n rows |
