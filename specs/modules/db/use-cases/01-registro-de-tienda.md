# 1. Registro de tienda (onboarding)

**Descripción**: Primer usuario llega al POS. Crea su tienda + admin user + settings default + primera sesión en una transacción atómica.

**Actores**: Usuario nuevo (no autenticado), Sistema

**Tablas involucradas**: `stores`, `users`, `accounts`, `settings`, `sessions`

**Endpoint**: `POST /api/v1/auth/register-store`

## Diagrama

```mermaid
sequenceDiagram
    actor U as Usuario nuevo
    participant F as Frontend (Pos.tsx/Auth.tsx)
    participant B as Backend (Rust)
    participant DB as PostgreSQL
    participant J as JWT

    U->>F: Abre app por primera vez
    F->>U: Form "Crear tienda"
    U->>F: Completa store_name + admin_profile
    F->>B: POST /api/v1/auth/register-store
    B->>B: Validar input (Rust + validator)
    B->>DB: BEGIN TX
    B->>DB: SELECT stores WHERE name = $1 (unicidad)
    alt name duplicado
        DB-->>B: existe
        B-->>F: 409 store_name ya registrado
    else name disponible
        B->>DB: INSERT INTO stores (name, address?, phone?)
        DB-->>B: store_id
        B->>DB: INSERT INTO users (name, email, role=admin, email_verified=true, store_id)
        DB-->>B: user_id
        B->>DB: INSERT INTO accounts (account_id=user_id, provider_id='credentials', password=bcrypt, user_id)
        B->>DB: INSERT INTO settings (store_id, name, address, phone, low_stock_threshold=5)
        B->>DB: COMMIT TX
        B->>J: generateTokens(user_id, email, role=admin, store_id, store_name)
        J-->>B: accessToken, refreshToken
        B->>DB: INSERT INTO sessions (user_id, token=refreshToken, expires_at=+7d)
        B-->>F: 201 Created { store, access_token, refresh_token }
        F->>U: Redirige a /pos
    end
```

## Side effects

1. `SET cookies: accessToken=…; refreshToken=…` (Fastify). Rust actual los devuelve en body — **decidir estandard**.

## Path Fastify ↔ Rust

| Fastify | Rust |
|---|---|
| `await prisma.$transaction(async tx => {...})` | `let mut tx = state.db.begin().await?; ... tx.commit().await?;` |
| `bcrypt.hash(password, 10)` | `hash_password(password)?` |
| `jwt.sign({ userId, email, role, storeId, storeName }, secret)` | `jwt::generate_tokens(...)` |
| `prisma.session.create({ token: refreshToken, ... })` | `SqlxSessionRepository.create(...)` |

## ⚠️ Acoplar a Fastify exactamente

- `email_verified = true` en admin onboarding (Fastify). Confirmar durante port.
- Token **en el body** (no cookie) en éxito de register-store. Fastify hace igual para register-store y register; solo login + refresh van por cookie.

## Errors a manejar

- `400` validación (e.g. password < 8).
- `409` store name duplicado o admin email duplicado.
- `500` error interno del DB.

## Tests sugeridos

- Onboarding completo → mockear DB → verificar 5 rows creadas + 2 tokens + 1 session.
- Concurrencia: dos requests simultáneos con el mismo store name → uno falla con 409.
- Reintento con token expirado después de registrar → no se regenera session.
