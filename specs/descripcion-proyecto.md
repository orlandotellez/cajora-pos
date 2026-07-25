# POS System — Descripcion del Proyecto

Sistema de **Punto de Venta (POS)** completo con backend, frontend y soporte desktop (Tauri). Orientado a pequeños y medianos comercios que necesitan gestionar productos, inventario, ventas, servicios, proveedores y configuración de su tienda.

---

## Stack tecnologico

| Capa | Tecnologia | Version |
|---|---|---|
| Backend principal (legado) | Node.js + Fastify | 5.x |
| Backend nuevo (en migracion) | Rust + Axum | 0.8 |
| ORM (legado) / query (nuevo) | Prisma / sqlx | 6.x / 0.8 |
| Base de datos | PostgreSQL | 16+ |
| Frontend | React + Vite + TypeScript | 18.x |
| UI kit | Radix UI (themes) | — |
| Routing cliente | React Router | 6.x |
| Desktop wrapper | Tauri | 2.x |
| Cache | Redis (opcional) | — |

El monorepo se compone de tres directorios principales:

- `backend-fastify/` — backend legado en Node.js (Fastify + Prisma). Es la **fuente de verdad** durante la migración.
- `backend-rust/` — backend nuevo en Rust (Axum + sqlx). Reemplazo progresivo del backend Fastify.
- `frontend/` — SPA con React + Vite. Tiene dual-target: navegador web y Tauri desktop.

---

## Modelo de negocio

- **Multi-tenant**: cada comercio es una **store**. Todos los datos (productos, ventas, inventario, usuarios, etc.) están scopeados a una `store`.
- **Roles dentro de una tienda**:
  - `admin` — crea la tienda en `POST /auth/register-store`, único rol con permiso de crear otros usuarios y gestionar configuración global.
  - `cajero` — opera el POS: registra ventas, hace movimientos de inventario manuales; no puede crear usuarios.
- **Decimal moneda**: todos los importes (`price`, `cost`, `subtotal`, `total`, `discount`, etc.) son `DECIMAL(10,2)` en PostgreSQL, no floats.
- **Soft-delete**: las entidades con catalogo (`product`, `category`, `supplier`, `service`) usan `deleted_at TIMESTAMPTZ` para borrado logico.

---

## Features del sistema

### Autenticacion y multi-tenant

- `POST /auth/register-store` — crea una tienda + usuario admin + settings por defecto (publico).
- `POST /auth/register` — el admin crea cajeros dentro de su tienda (protegido `adminGuard`).
- `POST /auth/login` — inicio de sesion por tienda (cookies httpOnly `accessToken` 15min + `refreshToken` 7d).
- `POST /auth/refresh` — rotacion de tokens (revoca session vieja, crea nueva + nuevos tokens).
- `POST /auth/logout` — cerrada de sesion (revoca session).
- `POST /auth/verify-email` — verificacion de correo con codigo de 6 caracteres.
- `POST /auth/resend-verification` — reenvio del codigo.
- `POST /auth/forgot-password` — solicitud de reseteo (codigo a `reset:<email>`).
- `POST /auth/reset-password` — reseteo con codigo + newPassword.
- `GET /auth/sessions` — lista sesiones activas del usuario actual.
- `DELETE /auth/sessions/:id` — revoca una sesion.

### Productos y catalogo

- `GET /products` (con filtros `search`, `category_id`, `active`, `low_stock`, `out_of_stock`, paginacion).
- `GET /products/:id` — detalle (incluye `category` y `supplier` resumidos).
- `GET /products/barcode/:barcode` — busqueda por codigo de barras (POS scanner).
- `POST /products` — alta (valida barcode unico, valida referencias).
- `PUT /products/:id` — edicion (soporta `null` para desenlazar category/supplier).
- `DELETE /products/:id` — soft-delete.
- `GET /categories` — publico (necesario para el formulario de productos).

### Servicios compuestos

- `GET /services` (con filtros `search`, `active`).
- `GET /services/:id` — detalle (incluye `service_products[]` con cantidad).
- `POST /services` — alta (con productos y cantidad que consume).
- `PUT /services/:id` — edicion.
- `DELETE /services/:id` — soft-delete.

### Ventas (POS)

- `POST /sales` — registro de venta completa:
  - Soporta items regulares + items de servicio.
  - Servicio con productos **custom** (override) o **auto** (busca `service_products`).
  - Validacion de stock sobre **todos** los productos (regulares + de servicio).
  - Descuento de stock automatico.
- `GET /sales` (filtros: `start_date`, `end_date`, `user_id`, `payment_method`, paginacion).
- `GET /sales/:id` — detalle completo (items, service_items con sus productos).
- `GET /sales/report?start_date=&end_date=` — reporte agregado (totales, ticket promedio, top productos, ventas por metodo de pago).
- `GET /sales/revenue-trend?start_date=&end_date=&group_by=day|week|month` — serie temporal de ingresos.

### Inventario

- `GET /inventory` (filtros: `product_id`, `movement_type`, paginacion).
- `GET /inventory/product/:id` — historial completo de un producto.
- `POST /inventory` — movimiento individual (`entrada | salida | ajuste`, ajusta stock).
- `GET /inventory/low-stock` — productos debajo del umbral.

### Inventario por lotes (batch)

- `POST /inventory/batches` — entrada / salida / ajuste masivo:
  - Crea `inventory_batch` + items + `inventory_movement[]` por producto, todo en transaccion Prisma.
  - Ajusta stock en `tx`.
- `GET /inventory/batches` (filtros: `movement_type`, `supplier_id`, paginacion).
- `GET /inventory/batches/:id` — detalle.

### Proveedores

- `GET /suppliers` (filtros `search`, `is_active`, paginacion).
- `GET /suppliers/:id` — detalle (incluye `_count.products`).
- `POST /suppliers` — alta.
- `PUT /suppliers/:id` — edicion.
- `DELETE /suppliers/:id` — soft-delete.

### Usuarios (admin)

- `GET /users` (filtros `search`, paginacion).
- `GET /users/:id`.
- `POST /users` — alta de cajero o admin (hashea password).
- `PUT /users/:id` — edicion (sin password; usar forgot/reset).
- `DELETE /users/:id` — soft-delete (setea `deleted_at`).

### Configuracion del negocio

- `GET /settings` — devuelve la config del store actual (tarifas, footer ticket, config impresora).
- `PUT /settings` — actualiza o hace upsert si no existe fila.

---

## Multi-tenancy

- Cada usuario pertenece a **un unico** store (`users.store_id`).
- Toda operacion de negocio debe ejecutarse dentro del contexto del store del usuario autenticado.
- `storeGuard` en Fastify rechaza requests sin ese contexto. En Rust hay que replicar como `store_guard` middleware.
- `register-store` es el unico endpoint que crea tienda; usa transaccion atomica.

---

## Roles & permisos

| Recurso | `admin` | `cajero` |
|---|---|---|
| register-store | sí (público) | n/a |
| login, logout, refresh, verify, reset | sí | sí |
| register otros usuarios | sí | no |
| GET /users, PUT /users/:id, DELETE /users/:id | sí | no |
| GET/POST/PUT/DELETE /products | sí | sí |
| GET /categories | público (sin auth) | público |
| /sales, /inventory, /batch, /services, /suppliers | sí | sí |
| GET /settings, PUT /settings | sí | sí |

---

## Convenciones transversales de la API

- **Prefijo**: todos los endpoints van bajo `/api/v1`.
- **Auth**: cookies `accessToken` (15 min) y `refreshToken` (7 días), ambas `httpOnly` y `sameSite=strict|lax` según entorno.
- **Content-Type**: `application/json` (no hay uploads).
- **Errores**: `{ "message": "..." }` con status code apropiado (400/401/403/404/409/422/429/500).
- **Paginacion**: `{ items: [...], total, page, limit, hasMore }` para todos los LIST.
- **Health**: `GET /health` (fuera de `/api/v1`).

---

## Estructura del monorepo

```
POS-SYSTEM-REPO/
├── backend-fastify/             # Legado (Fastify + Prisma)
│   ├── prisma/schema.prisma
│   ├── src/modules/            # 11 features
│   │   ├── auth/               # (domain, application, presentation, infrastructure)
│   │   ├── users/
│   │   ├── products/
│   │   ├── categories/         # vive dentro de products module
│   │   ├── services/
│   │   ├── sales/
│   │   ├── inventory/
│   │   ├── batch-inventory/
│   │   ├── suppliers/
│   │   └── settings/
│   ├── src/presentation/routes.ts   # `/auth`, `/products`, `/categories`, `/services`, `/sales`, `/inventory`, `/inventory/batches`, `/suppliers`, `/settings`, `/users`
│   └── src/server.ts
│
├── backend-rust/                # Nuevo (Axum + sqlx)
│   ├── src/
│   │   ├── main.rs
│   │   ├── database/migrations/20260629234600_full_schema.sql
│   │   ├── routes/mod.rs       # expone /api/v1/auth (con /register-store dentro)
│   │   ├── features/
│   │   │   ├── auth/           # ✅ implementado
│   │   │   └── stores/         # ✅ implementado (anidado bajo auth)
│   │   │   ↑ resto de features (users, products, etc.) ❌ pendiente
│   │   └── shared/             # config, security, errors, state, validation
│   └── Cargo.toml
│
├── frontend/                    # SPA (React + Vite)
│   └── src/pages/              # Auth, Pos, Products, Sales, Inventory, Services, Suppliers, Users, Settings
│
└── specs/                       # Documentacion del proyecto actual (USTED ESTA AQUI)
```

---

## Que hay en `specs/`

```
specs/
├── 00-migration-status.md      # Gap analysis Fastify -> Rust
├── descripcion-proyecto.md     # Este archivo
├── global-instruction.md       # Reglas para uso de IA en el repo
└── modules/
    ├── backend/                # Stack, arquitectura, convenciones
    ├── frontend/               # Stack, diseno, pantallas, arquitectura
    ├── api/                    # Especificacion REST por feature
    └── db/                     # Schema, enums, use-cases, setup
```
