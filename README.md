# POS System

![React](https://img.shields.io/badge/react-%2320232A.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Tauri](https://img.shields.io/badge/tauri-%23000000.svg?style=for-the-badge&logo=tauri&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%233178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-%23339933.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-%23000000.svg?style=for-the-badge&logo=fastify&logoColor=white)
![Astro](https://img.shields.io/badge/astro-%23000000.svg?style=for-the-badge&logo=astro&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![Axum](https://img.shields.io/badge/axum-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)

Sistema de Punto de Venta (POS) multiplataforma construido como **monorepo** con cuatro proyectos coordinados: un frontend común empaquetado con **Tauri** (Web + Desktop + Mobile), un backend **Node.js + Fastify** ya terminado, un backend alternativo **Rust + Axum** actualmente en desarrollo y un sitio de **landing page** en Astro.

El sistema cubre la operación típica de un negocio minorista: gestión de productos, categorías, proveedores, inventario por lotes y movimientos individuales, ventas (con productos y servicios), autenticación de usuarios, configuración del negocio y reportes. La landing page presenta el producto y sus planes.

---

## 📑 Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Estado del proyecto](#estado-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Configuración rápida](#configuración-rápida)
- [Frontend (Web / Desktop / Mobile)](#frontend-web--desktop--mobile)
- [Backend Fastify (terminado)](#backend-fastify-terminado)
- [Backend Rust (en progreso)](#backend-rust-en-progreso)
- [Landing Page (Astro)](#landing-page-astro)
- [Modelo de datos](#modelo-de-datos)
- [Variables de entorno](#variables-de-entorno)
- [Scripts útiles](#scripts-útiles)
- [Documentación adicional](#documentación-adicional)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                    │
│   src/ → React 19, Zustand, React Router, Recharts, Lucide      │
│                                                                  │
│   Empaquetado por TAURI 2  →  Web  |  Desktop  |  Mobile (Android)
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS / JWT en cookie httpOnly
                            ▼
        ┌──────────────────────────────┐    ┌──────────────────────────────┐
        │  backend-fastify (Node.js)   │    │   backend-rust (Rust)        │
        │   ✅ Terminado               │    │   🚧 En progreso             │
        │   Fastify 5 + Prisma 6       │    │   Axum 0.8 + SQLx 0.8        │
        │   Puerto por defecto         │    │   Puerto por defecto         │
        │   → http://localhost:3000    │    │   → http://localhost:4001    │
        └──────────────┬───────────────┘    └──────────────┬───────────────┘
                       │                                     │
                       ▼                                     ▼
              ┌──────────────────────────────────────────────────┐
              │   PostgreSQL  +  Redis (cache / rate-limit)      │
              └──────────────────────────────────────────────────┘
```

El frontend puede hablar con **cualquiera** de los dos backends: ambos exponen la misma API REST bajo `/api/v1` con autenticación por JWT (cookie httpOnly o bearer token) y los mismos recursos (productos, ventas, inventario, etc.).

---

## Stack tecnológico

### Frontend
| Capa | Tecnología |
| --- | --- |
| UI | **React 19** + TypeScript |
| Build / Dev server | **Vite 7** |
| Routing | **React Router 7** |
| Estado global | **Zustand 5** |
| Gráficos | **Recharts 3** |
| Iconos | **Lucide React** |
| Empaquetado multiplataforma | **Tauri 2** (Web + Desktop + Android) |
| Estilos | CSS Modules |

### Backend Fastify (✅ terminado)
| Capa | Tecnología |
| --- | --- |
| Framework | **Fastify 5** |
| ORM | **Prisma 6** |
| DB | **PostgreSQL** |
| Cache / Rate-limit | **Redis** (`ioredis`) |
| Auth | **JWT** (`@fastify/jwt`) + cookies httpOnly + bcrypt |
| Validación | **Zod** + `zod-to-json-schema` |
| Documentación API | **Swagger UI** en `/docs` |
| Seguridad | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/compress` |
| Logger | **Pino** + `pino-pretty` |
| Build | **tsup** + **tsx** (watch) |

### Backend Rust (🚧 en progreso)
| Capa | Tecnología |
| --- | --- |
| Framework | **Axum 0.8** + Tower HTTP |
| Async runtime | **Tokio** |
| DB | **SQLx 0.8** (PostgreSQL) |
| Cache | **Redis 0.27** |
| Auth | `jsonwebtoken` + `bcrypt` + cookies |
| Validación | `validator` (derive) |
| Serialización | `serde` / `serde_json` |
| Logging | `tracing` + `tracing-subscriber` |
| Config | `dotenvy` |
| Utilidades | `uuid`, `chrono`, `async-trait`, `nonce_cell` |

### Landing Page (✅ terminada)
| Capa | Tecnología |
| --- | --- |
| Framework | **Astro 7** |
| Lenguaje | TypeScript |
| Estilos | CSS puro con variables (design tokens) — sin Tailwind |
| Iconos | SVG inline (`Icon.astro`) |
| Tema | Claro/oscuro con toggle + `localStorage` + `prefers-color-scheme` |
| Deploy | Build estático (`output: static`) |

---

## Estructura del repositorio

```
.
├── frontend/                # React + Vite + Tauri (terminado)
│   ├── src/                 # Componentes, páginas, store, api, rutas
│   ├── src-tauri/           # Configuración Tauri (Rust shell + Android)
│   │   ├── src/             # main.rs / lib.rs (binario nativo)
│   │   ├── gen/android/     # Proyecto Android autogenerado
│   │   ├── capabilities/    # Permisos del WebView
│   │   └── tauri.conf.json  # Bundle web/desktop + ventana + ID
│   ├── components.json
│   ├── config-api.json.example
│   └── package.json
│
├── backend-fastify/         # API Node.js con Fastify (terminado)
│   ├── prisma/
│   │   ├── schema.prisma    # Modelo de datos completo
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts           # buildApp() → middlewares + Swagger + rutas
│   │   ├── server.ts        # Bootstrap + graceful shutdown
│   │   ├── config/          # env, prisma, redis
│   │   ├── core/            # utils, guard, errors
│   │   ├── infrastructure/  # logger
│   │   ├── modules/         # 10 módulos de dominio (DDD-lite)
│   │   │   ├── auth/
│   │   │   ├── batch-inventory/
│   │   │   ├── inventory/
│   │   │   ├── products/
│   │   │   ├── sales/
│   │   │   ├── services/
│   │   │   ├── settings/
│   │   │   ├── suppliers/
│   │   │   └── users/
│   │   ├── presentation/    # routes.ts + swagger-schema.ts
│   │   └── scripts/seed.ts  # Datos iniciales
│   ├── http/                # Colección de requests (.http) para VS Code / IntelliJ
│   └── docs/                # manual-fastify.md, prisma.md
│
├── backend-rust/            # API Rust con Axum (EN PROGRESO)
│   ├── src/
│   │   ├── main.rs          # Bootstrap Axum + CORS + TraceLayer
│   │   ├── routes/          # Router principal
│   │   ├── features/        # Patrón vertical slices (auth implementado)
│   │   │   └── auth/
│   │   │       ├── domain/           # contratos + entities
│   │   │       ├── application/      # servicios (registro, sesión…)
│   │   │       ├── presentation/     # handlers + dto + routes
│   │   │       └── infrastructure/   # sqlx repos + models + mapper
│   │   ├── shared/          # config, errors, security, state, validación
│   │   ├── database/        # conexión + migrations SQL
│   │   └── scripts/seed.rs  # Binario independiente de seed
│   ├── database/migrations/ # Migraciones SQL puras
│   └── docs/                # manual-axum.md, sqlx.md, estructura.md
│
└── landing-page/            # Sitio de marketing en Astro (terminado)
    ├── src/
    │   ├── components/      # Icon.astro (SVGs inline), Logo.astro
    │   ├── layouts/         # Layout.astro (design tokens + tema)
    │   ├── pages/           # index.astro
    │   └── sections/        # Header, Hero, Stats, Features, Pricing, FAQ, CTA, Footer
    ├── public/              # favicons
    ├── astro.config.mjs
    └── package.json
```

Cada workspace usa **pnpm** (frontend + backend-fastify + landing-page) y **Cargo** (backend-rust) como package manager.

---

## Estado del proyecto

| Componente | Estado |
| --- | --- |
| `backend-fastify/` | ✅ **Terminado** — todos los módulos implementados con arquitectura por capas (domain / application / presentation / infrastructure). |
| `frontend/` | ✅ **Terminado** — UI completa, estado global, integración con API, build para Web / Desktop / Android vía Tauri 2. |
| `landing-page/` | ✅ **Terminada** — sitio estático de marketing con Astro, secciones por componente, tema claro/oscuro y build estático. |
| `backend-rust/` | 🚧 **En progreso** — bootstrap, conexión a DB, CORS, tracing, shutdown graceful y **módulo `auth`** completos. El resto de features (products, sales, inventory, etc.) se está migrando siguiendo el mismo patrón `features/<recurso>/{domain,application,presentation,infrastructure}`. |

---

## Requisitos previos

Para desarrollo completo se necesita:

- **Node.js ≥ 20** y **pnpm ≥ 9**
- **Rust** (stable, edición 2024) + **Cargo** (solo si vas a tocar el backend Rust)
- **PostgreSQL ≥ 14**
- **Redis ≥ 6**
- (Opcional, para builds Tauri) **Java JDK 17** + **Android SDK / NDK** y toolchain de la plataforma destino.

---

## Configuración rápida

Asumiendo PostgreSQL y Redis ya corriendo:

```bash
# 1) Backend Fastify
cd backend-fastify
cp .env.example .env       # editar DATABASE_URL / REDIS_URL / JWT_SECRET / PORT / HOST
pnpm install
pnpm prisma:generate
pnpm prisma:migrate         # crea el esquema en PostgreSQL
pnpm seed                   # datos iniciales (usuario admin, productos demo…)
pnpm dev                    # arranca en http://localhost:3000 (Swagger en /docs)

# 2) Frontend (en otra terminal)
cd frontend
cp config-api.json.example config-api.json  # editar API_BASE_URL si corresponde
pnpm install
pnpm dev                    # Vite en http://localhost:1420 (puerto usado por Tauri)
pnpm tauri dev              # Lanza la app Tauri (web embebida + window nativa)
pnpm tauri build            # Build de release multiplataforma
pnpm tauri android dev      # Ejecuta en un dispositivo/emulador Android

# 3) Backend Rust (opcional, en otra terminal)
cd backend-rust
cp .env.example .env        # editar DATABASE_URL / REDIS_URL / JWT_SECRET
cargo run --bin server      # arranca en http://localhost:4001

# 4) Landing page (opcional, en otra terminal)
cd landing-page
pnpm install
pnpm dev                    # Dev server en http://localhost:4321
```

> Para usar el **backend Rust** solo hay que apuntar el frontend a `http://localhost:4001/api/v1` (configurable vía `config-api.json` o la variable de entorno del Vite dev server). Durante el periodo de transición ambos backends están operativos.

---

## Frontend (Web / Desktop / Mobile)

Aplicación SPA React con todas las pantallas funcionales:

- **Auth** — login, registro, verificación de email, recuperación de contraseña.
- **POS** (`/pos`) — buscador por código/nombre + carrito + pago con múltiples métodos (efectivo con cálculo de vuelto, tarjeta, transferencia) e impresión de ticket.
- **Productos** — CRUD, gestión de precios, costo, stock, umbral de stock bajo, unidad de medida.
- **Inventario** — movimientos individuales + **lotes** masivos (entradas / salidas / ajustes) con historial y trazabilidad por usuario.
- **Servicios** — servicios compuestos por N productos (receta) con precio base.
- **Ventas** — listado con detalle, filtros por fecha, productos, usuario.
- **Proveedores** — CRUD con productos asociados.
- **Usuarios** — gestión de roles (`admin` / `cajero`).
- **Reportes** — dashboard con KPIs, top productos, cierre de caja (gráficos con **Recharts**).
- **Settings** — datos del negocio, umbral de stock bajo, pie de ticket.
- **Sistema** — theme (claro/oscuro vía `ThemeContext`), toasts, confirmaciones, skeleton loaders, error boundary.

Empaquetado multiplataforma con **Tauri 2**: el mismo código React corre en navegador, escritorio (instalador nativo) y Android (`src-tauri/gen/android/`).

---

## Backend Fastify (terminado)

API REST en `/api/v1`. Cuenta con las siguientes capabilities transversales:

- **Autenticación**: registro, login, refresh, logout, verificación de email, reset password. JWT firmado + cookie httpOnly `accessToken`. Contraseñas hasheadas con bcrypt.
- **Autorización**: middleware `auth.guard` + roles (`admin`, `cajero`).
- **Validación** de payloads con **Zod** y respuestas con errores en español.
- **Documentación viva** en `GET /docs` (**Swagger UI**) generada con `@fastify/swagger` + `zod-to-json-schema`.
- **Rate limiting** (100 req/min) y **Helmet** (cabeceras de seguridad).
- **CORS** configurable vía `CORS_ORIGIN` (incluye los hosts del WebView Tauri y el dev server de Vite).
- **Compresión** gzip y logging estructurado con **Pino**.
- **Migraciones** (`pnpm prisma:migrate`) y **seed** con datos demo (`pnpm seed`).

### Módulos

| Módulo | Path | Endpoints principales |
| --- | --- | --- |
| **Auth** | `src/modules/auth` | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification` |
| **Users** | `src/modules/users` | CRUD + cambio de rol |
| **Products** | `src/modules/products` | CRUD + búsqueda por barcode |
| **Categories** | `src/modules/products/presentation/categories.routes.ts` | CRUD anidado |
| **Suppliers** | `src/modules/suppliers` | CRUD + soft delete |
| **Services** | `src/modules/services` | CRUD + composición con productos |
| **Inventory** | `src/modules/inventory` | Movimientos individuales |
| **Batch Inventory** | `src/modules/batch-inventory` | Entradas / salidas / ajustes masivos con detalle |
| **Sales** | `src/modules/sales` | Crear venta (productos + servicios), listado, detalle |
| **Settings** | `src/modules/settings` | Singleton de configuración del negocio |
| **Health** | `src/app.ts` | `GET /health` |

> En `backend-fastify/http/` hay una **colección `.http`** lista para probar cada endpoint desde VS Code o IntelliJ.

---

## Backend Rust (en progreso)

Réplica de la API escrita en Rust con el mismo contrato HTTP (mismo prefijo `/api/v1`, mismos DTOs y reglas de negocio) para comparar rendimiento y validar el modelo de datos entre ambas implementaciones.

- **Bootstrap** en `src/main.rs`: pool SQLx + CORS (`shared/config/cors.rs`) + `TraceLayer` + graceful shutdown (`shared/config/shutdown.rs`).
- **Patrón vertical slice** por feature → `features/<recurso>/{domain, application, presentation, infrastructure}`.
- **Módulo `auth`** ya implementado: contratos (domain), servicios (registration / authentication), handlers (login, refresh, logout, forgot/reset password, verify-email, resend, session) y repositorios SQLx.
- **Migraciones SQL** puras en `database/migrations/` (independientes del bootstrap).
- **Seed** independiente como binario (`cargo run --bin seed`).
- Documentación ampliada en `backend-rust/docs/` (`manual-axum.md`, `sqlx.md`, `estructura.md`).

> El resto de features (products, sales, inventory, services, users, suppliers, settings) se está migrando siguiendo el mismo esqueleto del módulo `auth`.

---

## Landing Page (Astro)

Sitio estático de marketing para Caja POS construido con **Astro 7** y CSS puro (sin Tailwind ni frameworks de estilos). Adapta el diseño de `template/landing-page.html` a componentes Astro con estilos scoped.

Secciones incluidas (cada una en `src/sections/`):

- **Header** — navbar fijo con glass effect, navegación con scrollspy (resalta la sección visible) y toggle de tema.
- **Hero** — título, CTAs y mockup de preview con glow de fondo.
- **Stats** — banda de 4 estadísticas (ventas rápidas, stock real, multi-usuario, 100% offline).
- **Features** — grilla de 6 tarjetas con iconos SVG.
- **Pricing** — plan self-hosted gratis y suscripción cloud con plan recomendado.
- **FAQ** — accordion nativo `<details>/<summary>` con respuestas.
- **CTA** — card final invertida con llamados a acción.
- **Footer** — logo, links legales y copyright.

Características:

- **Tema claro/oscuro** con toggle persistente (`localStorage`), respeta `prefers-color-scheme` como valor inicial y aplica el tema antes del primer paint (sin parpadeo).
- **Design tokens** en `src/layouts/Layout.astro`: colores, radios, sombras y espaciado vía CSS variables para ambos temas.
- **Iconos Lucide** inline en `src/components/Icon.astro` (sin dependencias externas de iconos).
- **Componentes**: `Icon.astro` y `Logo.astro` reutilizables en Header y Footer.

### Comandos

```bash
cd landing-page
pnpm install
pnpm dev        # Dev server en http://localhost:4321
pnpm build      # Build estático a ./dist/
pnpm preview    # Previsualizar el build
```

---

## Modelo de datos

Visión de alto nivel del esquema (definido en `backend-fastify/prisma/schema.prisma`, fuente de verdad durante la migración a Rust):

```
users ─┬─< sessions
       ├─< accounts
       ├─< sales ─< sale_items >── products ─┬─< categories
       │      └─< sale_services ─< sale_service_products ─┘
       │                                               │
       ├─< inventory_movements                         ├─< suppliers
       └─< inventory_batches ─< inventory_batch_items  │
                                                       │
                                              service_products
                                                  ↑
                                              services
settings (singleton)

Enums: ROLE (admin | cajero), UNIT_TYPE (unidad, paquete, caja, bolsa,
        botella, lata, sobre, barra, rollo, galon, ristra)
```

Convenciones:

- **Soft delete** (`deleted_at`) en usuarios, categorías, proveedores y servicios.
- **UUIDs** como PK.
- **Timestamps** `timestamptz` con `created_at` y `updated_at` automáticos.
- **Decimal(10,2)** para todos los importes monetarios.
- **Cascade delete** controlado en `service_product` y `sale_service_product`.

---

## Variables de entorno

### `backend-fastify/.env`

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `HOST` | Host del servidor | `0.0.0.0` |
| `PORT` | Puerto HTTP | `3000` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://user:pass@localhost:5432/pos` |
| `REDIS_URL` | Cadena de conexión Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Secreto para firmar JWT (mínimo 32 chars) | `cambiar-en-produccion` |
| `JWT_EXPIRES_IN` | TTL del access token | `15m` |
| `CORS_ORIGIN` | Orígenes permitidos (CSV) | `http://localhost:5173,http://localhost:1420` |

### `backend-rust/.env`

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgres://user:pass@localhost/pos` |
| `REDIS_URL` | Cadena de conexión Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Secreto JWT (debe coincidir con Fastify si se alternan backends) | `cambiar-en-produccion` |
| `RUST_LOG` | Nivel de tracing | `info,backend=debug` |

### Frontend

- `config-api.json` → URL base de la API (tiene `.example`).
- Variables estándar de Vite (`VITE_*`).

---

## Scripts útiles

```bash
# Backend Fastify
pnpm dev                    # watch con tsx
pnpm build                  # build con tsup
pnpm prisma:generate        # regenera Prisma Client
pnpm prisma:migrate         # crea/aplica migración
pnpm prisma:studio          # GUI de la DB
pnpm seed                   # datos demo

# Frontend
pnpm dev                    # Vite dev server
pnpm build                  # build estático
pnpm lint                   # ESLint
pnpm tauri dev              # App Tauri (dev)
pnpm tauri build            # Build de release
pnpm tauri android dev      # Dev en Android

# Backend Rust
cargo run --bin server      # API en :4001
cargo run --bin seed        # Seed de datos
cargo test                  # Tests
cargo fmt --all             # Formatear
cargo clippy --all-targets  # Lints

# Landing page
pnpm dev                    # Dev server en http://localhost:4321
pnpm build                  # Build estático a ./dist/
pnpm preview                # Previsualizar el build
```

---
