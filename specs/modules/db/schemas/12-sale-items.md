# `sale_items`

Items regulares vendidos dentro de un `sale`.

## Esquema

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PK` | — |
| `sale_id` | `UUID` | `FK → sales.id` `(ON DELETE RESTRICT)` | Venta padre. |
| `product_id` | `UUID` | `FK → products.id` `(ON DELETE RESTRICT)` | Producto vendido. |
| `product_name` | `TEXT` | `NOT NULL` | Snapshot del nombre al momento de venta. |
| `quantity` | `INTEGER` | `NOT NULL` | Cantidad. |
| `unit_price` | `NUMERIC(10,2)` | `NOT NULL` | Precio unitario al momento de venta (snapshot). |
| `line_total` | `NUMERIC(10,2)` | `NOT NULL` | `quantity × unit_price`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | — |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Trigger. |

## Índices

- `INDEX(sale_id)`.
- `INDEX(product_id)`.

## Snapshots

`product_name` y `unit_price` son **snapshots** del momento de venta. Esto preserva trazabilidad: si admin edita el precio del Coca 600ml de $25 a $30, las ventas previas de hoy siguen mostrando unit_price=25.

## Cálculo del line_total

```
line_total = quantity * unit_price
```

Server-side validation: comparamos `line_total` enviado en el body vs el calculado. Si difieren, **confiar en el cliente** (UX) o **recalcular** (más estricto). **Decidir** durante port — fastify recalcula.

## NO soft-delete

Nunca borramos `sale_items`. El historial de ventas es inmutable.
