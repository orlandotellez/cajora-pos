# 01 · Auth — Autenticación y sesión

> ✅ **Implementado en Rust** (`backend-rust/features/auth/`).

Endpoints de autenticación: registro inicial de tienda, login, refresh tokens, verificación de email, recuperación de contraseña y manejo de sesiones.

> ⚠️ **Importante**: la API **nunca devuelve tokens en el body de login/refresh** (Fastify los pega en cookies `httpOnly`). **Excepción**: `register-store` y `register` **sí** devuelven tokens en el body para que el cliente pueda iniciar sesión inmediatamente tras crear la tienda/usuario.

> ⚠️ Pendiente de ajuste: actualmente Rust devuelve `accessToken`+`refreshToken` en el body también para login — **decidir** si pegarlos via cookie también (preferible para Fastify parity).

## Tabla de endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register-store` | No | Crea tienda + admin user + settings default + sesión. |
| POST | `/auth/register` | Sí (admin) | Admin crea nuevo usuario (cajero o admin) dentro de su tienda. |
| POST | `/auth/login` | No | Inicia sesión y emite cookies de tokens. |
| POST | `/auth/refresh` | No (cookie refreshToken) | Renueva tokens (rotación real). |
| POST | `/auth/logout` | Sí | Cierra sesión: revoca session + limpia cookies. |
| POST | `/auth/verify-email` | No | Verifica email con código de 6 caracteres. |
| POST | `/auth/resend-verification` | No | Reenvía código de verificación. |
| POST | `/auth/forgot-password` | No | Solicita reseteo de contraseña. |
| POST | `/auth/reset-password` | No | Resetea con código + new password. |
| GET | `/auth/sessions` | Sí | Lista sesiones activas del usuario actual. |
| DELETE | `/auth/sessions/:id` | Sí | Revoca una sesión específica. |

---

## POST `/api/v1/auth/register-store` ✅

- **Auth**: No (público — primer endpoint que toca un usuario nuevo).
- **Content-Type**: `application/json`
- **Descripción**: flujo de onboarding. Crea tienda + admin + account + settings por defecto en una transacción Prisma. Devuelve `user`, `store`, `accessToken`, `refreshToken`.

### Request body

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

### Response 201

```json
{
  "message": "Store created successfully",
  "store": {
    "id": "uuid",
    "name": "Mi Tienda",
    "address": "Av. Siempre Viva 123",
    "phone": "+52 555 0001"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### Validaciones

- `store_name`: required, único en DB (global — no se permite el mismo nombre para dos tiendas).
- `admin_email`: required, único DB.
- `admin_password`: min 8 chars.
- `admin_name`: min 2 chars.

### Errores comunes

- `400 Bad Request` — payload inválido.
- `409 Conflict` — store name o admin email ya existe.

### Side effects (transacción `prisma.$transaction`)

1. INSERT `stores`.
2. INSERT `users` (role=admin, email_verified=true, store_id=stores.id).
3. INSERT `account` (provider=credentials, password=bcrypt hash).
4. INSERT `settings` (low_stock_threshold=5).
5. COMMIT.
6. Generar tokens (access 15min, refresh 7d).
7. INSERT `session` (refresh_token, expires_at=now+7d).

---

## POST `/api/v1/auth/register` ✅ (admin only)

- **Auth**: Sí + RequireAdmin + StoreGuard.
- **Descripción**: el admin crea nuevos usuarios (principalmente cajeros) en su tienda. Crea session + código de verificación.

### Request body

```json
{
  "name": "Cajero Juan",
  "email": "juan@pos.com",
  "password": "password123",
  "role": "cajero",
  "phone": "+52 555 0002"
}
```

### Response 201

```json
{
  "message": "User created successfully. Please verify your email.",
  "user": {
    "id": "uuid",
    "name": "Cajero Juan",
    "email": "juan@pos.com",
    "role": "cajero",
    "phone": "+52 555 0002",
    "image": null,
    "email_verified": false,
    "store_id": "uuid"
  },
  "store": {
    "id": "uuid",
    "name": "Mi Tienda"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### Validaciones

- `email`: único dentro de la tienda (par (`store_id`, `email`) UNIQUE).
- `role`: `admin | cajero`.
- `password`: min 8 chars.

### Errores comunes

- `400`, `401`, `403` (no admin), `409` (email duplicado en esta tienda).

### Side effects

1. INSERT user (email_verified=false).
2. INSERT account (password=bcrypt).
3. INSERT verification (code 6 chars, expires_at=now+15min). **Logger imprime** el código en consola dev (sustituir por email service cuando se integre).
4. Emitir tokens + session.

---

## POST `/api/v1/auth/login` ✅

- **Auth**: No.
- **Descripción**: valida email + password (bcrypt). **Devuelve tokens via cookies `httpOnly`** (helper `setAuthCookies` en `cookie.utils.ts`).

### Request body

```json
{
  "email": "carlos@mitienda.com",
  "password": "MiPassword123"
}
```

### Response 200

```json
{
  "message": "Login successfully",
  "user": { /* UserResponseFull */ },
  "store": { "id": "uuid", "name": "Mi Tienda" }
}
```

> ⚠️ Fastify pega tokens en cookies `Set-Cookie: accessToken=…; refreshToken=…`. Rust los devuelve también en body — **decidir** estandard.

### Errores comunes

- `401 Unauthorized` — credenciales inválidas (sin distinguir email vs password para evitar user enumeration).
- `401 Unauthorized` — cuenta desactivada (`deleted_at` set).

### Side effects

1. INSERT session (refresh_token, expires_at=now+7d).
2. `Set-Cookie: accessToken=…; Path=/; HttpOnly; SameSite=strict; Max-Age=900`.
3. `Set-Cookie: refreshToken=…; …; Max-Age=604800`.

---

## POST `/api/v1/auth/refresh` ✅

- **Auth**: No (pero requiere cookie `refreshToken` válida).
- **Descripción**: **rotación real** — revoca session vieja, crea una nueva, emite tokens nuevos vía cookies `httpOnly`.

### Request

Sin body. Solo cookie `refreshToken` (o campo `refreshToken` en body como fallback en Fastify).

### Response 200

```json
{ "message": "Token refreshed successfully", "user": {...}, "store": {...} }
```

### Errores comunes

- `401 Unauthorized` — refresh token inválido / expirado / sin session en DB.

### Side effects

1. DELETE session con `token = refresh_token`.
2. INSERT nueva session.
3. Set cookies nuevas.

---

## POST `/api/v1/auth/logout` ✅

- **Auth**: Sí.

### Request body / cookie

`refreshToken` (cookie `refreshToken` o body). Logout NO requiere body si el refreshToken viene en cookie.

### Response 200

```json
{ "message": "Logged out successfully" }
```

### Errores comunes

- `401 Unauthorized` — sin auth válida.

### Side effects

1. DELETE session WHERE token = refresh_token.
2. `Set-Cookie: accessToken=…; Max-Age=0` (limpia cookie).
3. `Set-Cookie: refreshToken=…; Max-Age=0` (limpia cookie).

---

## POST `/api/v1/auth/verify-email` ✅

- **Auth**: No.

### Request body

```json
{
  "identifier": "user@store.com",
  "code": "ABC123"
}
```

### Response 200

```json
{ "message": "Email verified successfully" }
```

### Errores comunes

- `401` — código inválido o expirado.
- `404` — user no existe.

### Side effects

1. Match `verification` por `identifier+value`.
2. UPDATE user.email_verified = true.
3. DELETE verification.
4. INSERT session + emitir tokens.

---

## POST `/api/v1/auth/resend-verification` ✅

- **Auth**: No (mensaje genérico para evitar enumeración).

### Request body

```json
{ "email": "user@store.com" }
```

### Response 202

```json
{
  "message": "New verification code sent",
  "expiresAt": "2026-07-23T13:00:00Z"
}
```

### Errores comunes

- `409 Conflict` — email ya verificado.
- `200 / 202` — email no existe (respuesta genérica idéntica al caso exitoso, sin filtrar).

---

## POST `/api/v1/auth/forgot-password` ✅

- **Auth**: No.

### Request body

```json
{ "email": "user@store.com" }
```

### Response 202

```json
{
  "message": "If the email exists, a reset code has been sent",
  "expires_at": "2026-07-23T13:00:00Z"
}
```

### Side effects

1. SELECT user.
2. Si existe: INSERT verification (identifier=`reset:<email>`, value=codigo 6 chars, expires_at+15min).

---

## POST `/api/v1/auth/reset-password` ✅

- **Auth**: No.

### Request body

```json
{
  "email": "user@store.com",
  "code": "ABC123",
  "newPassword": "OtroPassword456"
}
```

### Response 200

```json
{ "message": "Password reset successfully. Please login with your new password." }
```

### Validaciones

- `newPassword`: min 8 chars.

### Errores comunes

- `401` — código inválido o expirado.
- `404` — user / account no existe.

### Side effects

1. Match verification con `identifier=`reset:<email>` AND value=code.
2. UPDATE account.password = bcrypt(newPassword).
3. DELETE sessions (todas las del user — fuerza re-login en otros dispositivos).
4. DELETE verification.

---

## GET `/api/v1/auth/sessions` ✅

- **Auth**: Sí.

### Response 200

```json
{
  "sessions": [
    {
      "id": "uuid",
      "expires_at": "2026-07-30T10:00:00Z",
      "ip_address": "127.0.0.1" | null,
      "user_agent": "Mozilla/..." | null,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

Solo devuelve sesiones con `expires_at > now`.

---

## DELETE `/api/v1/auth/sessions/:id` ✅

- **Auth**: Sí.

### Response 200

```json
{ "message": "Session revoked successfully" }
```

### Errores comunes

- `404 Not Found` — sesion no existe o no pertenece al usuario actual.

### Side effects

DELETE session WHERE token = (SELECT token FROM session WHERE id=:id AND user_id:current).

---

## JWT Payload (Fastify parity)

```json
{
  "user_id": "uuid",
  "email": "string",
  "role": "admin | cajero",
  "store_id": "uuid",
  "store_name": "string",
  "exp": 1234567890
}
```

> ⚠️ Backend Rust actual solo firma `{ userId, email, role }`. **Fix pendiente en `shared/security/jwt.rs`** para incluir `store_id` y `store_name` — **pero antes verificar**: leer `token.utils.ts` actualizado del Fastify; el `manual-fastify.md` dice 3 params mientras `auth.service.ts` llama con 5. **Verificar la firma real antes de portar**.
