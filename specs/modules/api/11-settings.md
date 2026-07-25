# 11 · Settings — Configuración del negocio

> ❌ **Pendiente en Rust**.
> ✅ Fastify en `backend-fastify/src/modules/settings/`.

Configuración global de la tienda: datos del negocio, footer ticket, y configuración de impresora térmica.

## Tabla de endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/settings` | Sí | Devuelve la settings del store actual. |
| PUT | `/settings` | Sí | Actualiza (upsert). |

---

## GET `/api/v1/settings`

- **Auth**: Sí + StoreGuard.

### Response 200

```json
{
  "name": "Mi Tienda",
  "address": "Av. Siempre Viva 123",
  "phone": "+52 555 0001",
  "low_stock_threshold": 5,
  "ticket_footer": "¡Gracias por su compra!",
  "printer_name": "EPSON-TM20",
  "printer_interface": "network",
  "printer_ip": "192.168.1.100",
  "printer_port": 9100,
  "printer_paper_size": "80mm",
  "printer_cut_after": true,
  "printer_open_drawer": false,
  "updated_at": "..."
}
```

> Si no existe fila de settings para el store (caso edge), retorna defaults.
> **`store_id` no se devuelve** (es interno del JWT).

### Errores comunes

- `500` si la DB no responde.

---

## PUT `/api/v1/settings`

- **Auth**: Sí + StoreGuard.

### ⚠️ IMPORTANTE — Printer fields NO expuestos actualmente

La tabla `settings` tiene columnas `printer_name`, `printer_interface`, `printer_ip`, `printer_port`, `paper_size`, `printer_cut_after`, `printer_open_drawer` agregadas por la migración `20260709033600_add_printer_settings`. Sin embargo, **el DTO actual del Fastify (`settings.dto.ts → UpdateSettingsDtoSchema`) NO incluye esos campos**. Solo expone `name`, `address`, `phone`, `low_stock_threshold`, `ticket_footer`.

> 🆘 **Decisión para el port a Rust**: agregar `printer_*` al DTO de update y al menos aceptar opcionalmente en el request body. Sin esto, los valores de impresora quedan fijos en sus defaults. Configurar la impresora entonces requiere SQL directo a la tabla.

### Request body (campos actuales + opcionales printer)

```json
{
  "name": "Mi Tienda",
  "address": "Av. Siempre Viva 123",
  "phone": "+52 555 0001",
  "low_stock_threshold": 5,
  "ticket_footer": "¡Gracias por su compra!",
  "printer_name": "EPSON-TM20",
  "printer_interface": "network",
  "printer_ip": "192.168.1.100",
  "printer_port": 9100,
  "printer_paper_size": "80mm",
  "printer_cut_after": true,
  "printer_open_drawer": false
}
```

### Validaciones


- `low_stock_threshold`: int ≥ 0.
- `name`: si presente, min 1.
- resto: free text.

### Side effects

- UPSERT en `settings` por `store_id`.

```sql
INSERT INTO settings (store_id, name, ..., updated_at)
VALUES ($1, $2, ..., NOW())
ON CONFLICT (store_id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, settings.name),
  address = COALESCE(EXCLUDED.address, settings.address),
  ...
  updated_at = NOW();
```

> ⚠️ En Fastify el frontend usa `.optional().nullable()` para cada campo, lo que permite no pisar campos no enviados. El handler ejecuta un partial update **a mano** (mapea campos no nulos). **En Rust**: misma lógica — `UpdateSettingsRequest` con `Option<Option<String>>` (None = "no enviar"; Some(None) = "set a NULL") o un struct más simple con `Option<T>` y construir manualmente el SET clause.

### Errores comunes

- `400`. Sin 404/409.

---

## Detalle de implementación

### Tabla `settings` (referencia)

```sql
CREATE TABLE settings (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL UNIQUE,
  name TEXT DEFAULT 'Mi Negocio',
  address TEXT,
  phone TEXT,
  low_stock_threshold INTEGER DEFAULT 5,
  ticket_footer TEXT,
  printer_name TEXT,
  printer_interface TEXT,    -- 'usb' | 'network' | 'serial'
  printer_ip TEXT,
  printer_port INTEGER,
  paper_size TEXT DEFAULT '80mm', -- '80mm' | '58mm'
  printer_cut_after BOOLEAN DEFAULT true,
  printer_open_drawer BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ,
  ...
  CONSTRAINT settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);
```

> `store_id` **UNIQUE** — una sola fila por tienda.

### Repository

```rust
pub trait SettingsRepository {
    async fn get(&self, store_id: Uuid) -> Result<Option<Settings>, AppError>;
    async fn upsert(&self, store_id: Uuid, data: UpdateSettingsData) -> Result<Settings, AppError>;
}
```

### Service

```rust
pub async fn get(store_id: Uuid) -> SettingsResponse {
    match repo.get(store_id).await? {
        Some(s) => SettingsResponse::from(s),
        None => SettingsResponse::defaults(),  // low_stock_threshold=5, etc.
    }
}

pub async fn update(store_id: Uuid, data: UpdateSettingsData) -> SettingsResponse {
    let s = repo.upsert(store_id, data).await?;
    SettingsResponse::from(s)
}
```

---

## Frontend

`frontend/src/pages/Settings.tsx`:

- Botón "Guardar" → `PUT /settings`.
- Sección "Impresora" para POS con toggle "+ Abrir cajón de dinero después de imprimir".
- Sección "Ticket" para editar `ticket_footer` (texto que aparece al pie del ticket).

---

## Checklist de migración

| Tarea | Archivo destino |
|---|---|
| `features/settings/domain/entities.rs` | `Settings`. |
| `domain/contracts/settings_repository.rs` | Trait. |
| `application/settings_service.rs` | get + update. |
| `presentation/dto/{request,response}.rs` | `UpdateSettingsRequest` con derive(Validate). |
| `presentation/handlers/settings_handler.rs` | 2 handlers. |
| `infrastructure/sqlx/settings_repository.rs` | Query `ON CONFLICT (store_id) DO UPDATE`. |
| `nest("/api/v1/settings", ...)`. |
