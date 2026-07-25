# `products`

Producto del catálogo. La pieza más importante del POS.

## Esquema

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PK` | — |
| `barcode` | `TEXT` | NULL, UNIQUE por tienda | Código de barras (e.g. EAN-13). |
| `name` | `TEXT` | `NOT NULL` | Nombre del producto. |
| `unit_type` | `UNIT_TYPE` | NULL | Ver enum [`02-unit-type.md`](../enums/02-unit-type.md). |
| `unit_quantity` | `INTEGER` | NULL | Cantidad de unidades (e.g. paquete de 6). |
| `category_id` | `UUID` | `FK → categories.id` `(ON DELETE SET NULL)` | Categoría. |
| `supplier_id` | `UUID` | `FK → suppliers.id` `(ON DELETE SET NULL)` | Proveedor principal. |
| `price` | `NUMERIC(10,2)` | `NOT NULL` | Precio de venta. |
| `cost` | `NUMERIC(10,2)` | `NOT NULL DEFAULT 0` | Costo (para utilidad). |
| `stock` | `INTEGER` | `NOT NULL DEFAULT 0` | Stock actual. ⚠️ Hot field. |
| `low_stock_threshold` | `INTEGER` | `NOT NULL DEFAULT 5` | Umbral de stock bajo. |
| `active` | `BOOLEAN` | `NOT NULL DEFAULT true` | Activo/Inactivo en POS. |
| `store_id` | `UUID` | `FK → stores.id` `(ON DELETE SET NULL)` | Tienda. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | — |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Trigger. |
| `deleted_at` | `TIMESTAMPTZ` | NULL | Soft-delete. |

## Índices

- `INDEX(barcode)` — lookup exacto del POS scanner.
- `INDEX(name)` — search.
- `INDEX(category_id)`, `INDEX(supplier_id)`.
- `INDEX(active)` — filtros.
- `INDEX(store_id)`.

## UNIQUE constraint

| Columna | Constraint | Notas |
|---|---|---|
| `barcode` | `UNIQUE(store_id, barcode)` (pending de agregar) | evita 2 productos con mismo barcode en la misma tienda. |

> ⚠️ En la migración actual (`full_schema.sql`) el UNIQUE index no está explícito. **Agregar durante port a Rust** vía nueva migración sqlx.
>
> ```sql
> CREATE UNIQUE INDEX products_store_id_barcode_key ON products(store_id, barcode) WHERE deleted_at IS NULL;
> ```

## Relaciones (see other schemas)

- `sale_items` 1:N.
- `inventory_movements` 1:N.
- `inventory_batch_items` 1:N.
- `service_products` 1:N (composición de services).
- `sale_service_products` 1:N.

## Hot fields (lock contention)

`stock` se actualiza **dentro de transacciones de ventas**. En alta concurrencia, podría haber contention. Para el MVP no es un problema, pero a futuro considerar:

- `SELECT ... FOR UPDATE` dentro del tx.
- Versión optimista con `version` column.
- Event-sourcing del stock.

Ver [`use-cases/02-flujo-de-venta`](../use-cases/02-flujo-de-venta.md) y [API sales](../../api/10-sales.md).
