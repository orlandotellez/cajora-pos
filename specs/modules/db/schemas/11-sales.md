# `sales`

Cabecera de venta. Cada venta es UN row con totales agregados y referencias a las lineas (`sale_items`, `sale_services`).

## Esquema

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PK` | — |
| `subtotal` | `NUMERIC(10,2)` | `NOT NULL` | Suma de `sale_items.line_total + sale_services.line_total - discount`. |
| `discount` | `NUMERIC(10,2)` | `NOT NULL DEFAULT 0` | Descuento aplicado a nivel venta. |
| `total` | `NUMERIC(10,2)` | `NOT NULL` | Total final a pagar. |
| `payment_method` | `TEXT` | `NOT NULL` | Enum textual: `efectivo \| tarjeta \| transferencia \| credito`. |
| `amount_received` | `NUMERIC(10,2)` | NULL | Solo para `efectivo` — monto entregado por el cliente. |
| `change_given` | `NUMERIC(10,2)` | NULL | Solo para `efectivo` — cambio devuelto. |
| `user_id` | `UUID` | `FK → users.id` `(ON DELETE RESTRICT)` | Cajero que registró la venta. |
| `store_id` | `UUID` | `FK → stores.id` `(ON DELETE REST NULL)` | Tienda. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | — |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Trigger. |

## Índices

- `INDEX(created_at)` — queries por rango de fechas (reportes).
- `INDEX(user_id)`.
- `INDEX(store_id)`.

## Relaciones

- `sale_items` 1:N (items regulares vendidos).
- `sale_services` 1:N (services vendidos).

## NO soft-delete

Ventas son **inmutables** una vez creadas. ⚠️ La corrección se hace emitiendo una venta negativa (refactura) — **decidir** durante port a Rust si se implementa o se queda con "void" (soft-delete) manual.

## Pago en efectivo

- `amount_received` ≥ `total`.
- `change_given` = `amount_received - total` (calculado server-side; cliente lo pasa para verificación, server lo puede recalcular).

## Pago con tarjeta / transferencia / crédito

- `amount_received` y `change_given` son NULL.

## Snapshots de items

`product_name` y `service_name` se **guardan como snapshot** dentro de `sale_items` / `sale_services`. Así si el nombre de un producto cambia después, la venta histórica sigue mostrando el nombre original.
