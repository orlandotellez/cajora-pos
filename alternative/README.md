# Alternative Backends

Carpeta que contiene implementaciones alternativas del backend de CajoraPOS. Estos backends exponen la **misma API REST** que el backend principal (`backend-fastify/`), permitiendo comparar rendimiento, validar el modelo de datos entre implementaciones y explorar tecnologías distintas.

---

## Contenido

| Backend | Tecnología | Estado |
| --- | --- | --- |
| `backend-rust/` | Rust + Axum 0.8 + SQLx 0.8 | 🚧 En progreso |

---

## Backend Rust (Axum)

Réplica de la API escrita en Rust con el mismo contrato HTTP (prefijo `/api/v1`, mismos DTOs y reglas de negocio) para comparar rendimiento y validar el modelo de datos entre ambas implementaciones.

### Stack

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
| Utilidades | `uuid`, `chrono`, `async-trait` |

### Estructura

```
backend-rust/
├── src/
│   ├── main.rs              # Bootstrap Axum + CORS + TraceLayer
│   ├── routes/              # Router principal
│   ├── features/            # Patrón vertical slices (auth implementado)
│   │   └── auth/
│   │       ├── domain/      # Contratos + entities
│   │       ├── application/ # Servicios (registro, sesión…)
│   │       ├── presentation/ # Handlers + dto + routes
│   │       └── infrastructure/ # SQLx repos + models + mapper
│   ├── shared/              # Config, errors, security, state, validación
│   ├── database/            # Conexión + migrations SQL
│   └── scripts/seed.rs     # Binario independiente de seed
├── .sqlx/                   # SQLx offline query cache
├── docs/                    # manual-axum.md, sqlx.md, estructura.md
└── Cargo.toml
```

### Configuración

```bash
cd alternative/backend-rust
cp .env.example .env        # editar DATABASE_URL / REDIS_URL / JWT_SECRET
cargo run --bin server       # arranca en http://localhost:4001
```

### Scripts

```bash
cargo run --bin server       # API en :4001
cargo run --bin seed         # Seed de datos
cargo test                   # Tests
cargo fmt --all              # Formatear
cargo clippy --all-targets   # Lints
```

### Estado actual

- ✅ Bootstrap, conexión a DB, CORS, tracing, graceful shutdown
- ✅ Módulo `auth` completo (registro, login, refresh, logout, forgot/reset password, verify-email, resend, session)
- 🚧 Pendiente: products, sales, inventory, services, users, suppliers, settings

> El resto de features se está migrando siguiendo el mismo esqueleto del módulo `auth` con el patrón vertical slices: `features/<recurso>/{domain, application, presentation, infrastructure}`.

---

Para usar el **backend Rust** con el frontend, apunta `config-api.json` a `http://localhost:4001/api/v1`.
