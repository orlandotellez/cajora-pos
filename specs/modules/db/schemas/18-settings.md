# `settings`

Configuración del negocio + impresora POS. Una sola fila por tienda (`UNIQUE(store_id)`).

## Esquema

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | Auto-increment. |
| `store_id` | `UUID` | `UNIQUE`, `FK → stores.id` `(ON DELETE CASCADE)` | Tienda. |
| `name` | `TEXT` | `NOT NULL DEFAULT 'Mi Negocio'` | Nombre comercial. |
| `address` | `TEXT` | NULL | Dirección. |
| `phone` | `TEXT` | NULL | Teléfono. |
| `low_stock_threshold` | `INTEGER` | `NOT NULL DEFAULT 5` | Umbral default de stock bajo. |
| `ticket_footer` | `TEXT` | NULL | Texto al pie del ticket. |
| `printer_name` | `TEXT` | NULL | Nombre de la impresora (e.g. "EPSON-TM20"). |
| `printer_interface` | `TEXT` | NULL | `usb`, `network`, `serial`. |
| `printer_ip` | `TEXT` | NULL | IP de la impresora (si `network`). |
| `printer_port` | `INTEGER` | NULL | Puerto (e.g. 9100 para ESC/POS). |
| `paper_size` | `TEXT` | `DEFAULT '80mm'` | `80mm` o `58mm`. |
| `printer_cut_after` | `BOOLEAN` | `NOT NULL DEFAULT true` | Cortar papel después de imprimir. |
| `printer_open_drawer` | `BOOLEAN` | `NOT NULL DEFAULT false` | Abrir cajón de dinero después de imprimir. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Trigger. |

## Índices

- `UNIQUE(store_id)` garantiza 1 fila por tienda.
- `INDEX(store_id)` adicional (redundante pero inofensivo).

## UPSERT

API endpoint `PUT /settings` hace UPSERT:

```sql
INSERT INTO settings (store_id, name, ..., updated_at)
VALUES (...)
ON CONFLICT (store_id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, settings.name),
  ...
  updated_at = NOW();
```

## Cascade

`ON DELETE CASCADE` en `store_id` — si la tienda se hard-deletea (no implementado normal), la config se va con ella.

## Migration history

- La columna `id BIGSERIAL` (no UUID) es legacy de Prisma. Coexiste con `store_id UNIQUE` como identificador "natural".
- Columns de impresora fueron agregados en migración `20260709033600_add_printer_settings`.
