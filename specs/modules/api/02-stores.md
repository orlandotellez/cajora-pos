# 02 · Stores — Multi-tenant

> ✅ `register-store` ya esta implementado en Rust (viviendo como `POST /api/v1/auth/register-store`).
> ❌ Endpoints adicionales de gestion de tienda pendientes.

Store es la unidad multi-tenant: cada usuario pertenece a una sola tienda. La tienda **se crea una sola vez** en el flujo de onboarding (`register-store`); el resto de operaciones son management del propio admin.

## Tabla de endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register-store` | No | Onboarding inicial: crea tienda + admin user + settings. |
| GET | `/stores/me` | Sí | Devuelve la tienda del usuario actual (admin y cajero pueden leer). |
| PATCH | `/stores/me` | Sí + Admin | Actualiza datos basicos de la tienda actual (nombre, address, phone). |
| GET | `/stores/me/stats` | Sí + Admin | Estadisticas agregadas: cantidad de usuarios, productos activos, ventas del mes. (futuro) |

> ⚠️ Decision pendiente: separar `/stores` a su propio `Router` (anidado con `nest("/api/v1/stores", ...)`) o seguir como hoy bajo `/auth`. **Recomendado** mover a `/stores/me` por claridad.

---

## POST `/api/v1/auth/register-store` ✅

> Ver [`01-auth.md`](./01-auth.md#post-apiv1authregister-store-) — alias aqui para recordatorio.

### Request

```json
{
  "store_name": "Mi Tienda",
  "store_address": "Av. Siempre Viva 123",
  "store_phone": "+52 555 0001",
  "admin_name": "Carlos",
  "admin_email": "carlos@mitienda.com",
  "admin_password": "MiPassword123"
}
```

### Response

```json
{
  "message": "Store created successfully",
  "store": { "id": "uuid", "name": "Mi Tienda", "address": "...", "phone": "..." },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### Validaciones

- `store_name`: required, UNIQUE en DB.
- `admin_email`: required, UNIQUE.
- `admin_password`: min 8 chars.

---

## GET `/api/v1/stores/me` (futuro)

- **Auth**: Sí.

### Response 200

```json
{
  "id": "uuid",
  "name": "Mi Tienda",
  "address": "Av. Siempre Viva 123",
  "phone": "+52 555 0001",
  "settings": {
    "low_stock_threshold": 5,
    "ticket_footer": "Gracias por su compra",
    "printer_name": "EPSON-TM20",
    "printer_interface": "network",
    "paper_size": "80mm"
  },
  "created_at": "2026-..."
}
```

> Devuelve la tienda + settings del usuario actual (read-only salvo admin).

---

## PATCH `/api/v1/stores/me` (futuro)

- **Auth**: Sí + Admin.

Body parcial:

```json
{
  "name": "Mi Tienda Oficial",
  "address": "Otra direccion",
  "phone": "+52 555 0002"
}
```

### Response 200

```json
{ "id": "uuid", "name": "Mi Tienda Oficial", ... }
```

---

## GET `/api/v1/stores/me/stats` (futuro)

- **Auth**: Sí + Admin.

### Response 200

```json
{
  "users_count": 4,
  "products_active": 213,
  "products_low_stock": 7,
  "sales_today": { "count": 12, "total": 3456.78 },
  "sales_this_month": { "count": 312, "total": 78456.20 }
}
```

---

## Multi-tenancy rules

- **Cada usuario pertenece a exactamente una tienda.** `users.store_id` FK NOT NULL (despues del SQL migration actual).
- **Toda operacion de negocio** (productos, ventas, inventario, etc.) filtra por `store_id`.
- **Store name** UNIQUE globalmente. ⚠️ Decisión de negocio: si esto permite o no multiples "Mi Tienda" — hoy el schema lo prohibe.
- **Soft-delete de store** NO esta implementado: la tienda no se borra (preserva integridad de ventas historicas). Para descontinuar, contactar soporte y migrar manualmente.

---

## Migración de implementación (checklist)

| Tarea | Estado | Notas |
|---|---|---|
| Mover handler `/register-store` a un modulo `features/stores/` con `nest("/api/v1/stores", ...)` | ⚠️ Parcial | hoy vive en `features/auth/presentation/handlers/store_handler.rs`. Mover. |
| `GET /stores/me` | ❌ | nueva ruta. |
| `PATCH /stores/me` | ❌ | nueva ruta. |
| `GET /stores/me/stats` | ❌ | opcional, agregar query agregada en `infrastructure`. |
| Documentar en OpenAPI cuando se agregue `utoipa` | ❌ | pendiente. |
