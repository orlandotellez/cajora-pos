# Axum Manual — Manual Paso a Paso

### Backend en Rust con Axum, SQLx y Tokio desde cero

Este manual te guía en la construcción de un backend completo de autenticación (registro, login, JWT, verificación de email, recuperación de contraseña, manejo de sesiones). Está diseñado para que puedas **reproducir cada archivo por tu cuenta**, entendiendo qué hace cada línea y por qué se tomaron las decisiones técnicas.

---

## Índice

1. [Crear el proyecto](#1-crear-el-proyecto)
2. [`Cargo.toml` — Configuración de dependencias](#2-cargotoml--configuración-de-dependencias)
3. [Estructura de directorios](#3-estructura-de-directorios)
4. [Archivo `.env` — Variables de entorno](#4-archivo-env--variables-de-entorno)
5. [`src/main.rs` — Punto de entrada](#5-srcmainrs--punto-de-entrada)
6. [Módulo `shared/state` — Estado compartido `AppState`](#6-módulo-sharedstate--estado-compartido-appstate)
7. [Módulo `shared/config` — Configuración global](#7-módulo-sharedconfig--configuración-global)
8. [Módulo `shared/errors` — Manejo de errores](#8-módulo-sharederrors--manejo-de-errores)
9. [Módulo `shared/security` — JWT, passwords, cookies, auth guards](#9-módulo-sharedsecurity--jwt-passwords-cookies-auth-guards)
10. [Módulo `shared/helpers` — Utilidades](#10-módulo-sharedhelpers--utilidades)
11. [Módulo `shared/validation` — Validación](#11-módulo-sharedvalidation--validación)
12. [Módulo `database` — Conexión y migraciones](#12-módulo-database--conexión-y-migraciones)
13. [Migración SQL — Esquema completo de base de datos](#13-migración-sql--esquema-completo-de-base-de-datos)
14. [Feature `auth/domain` — Entidades y contratos](#14-feature-authdomain--entidades-y-contratos)
15. [Feature `auth/infrastructure` — Modelos y repositorios SQLx](#15-feature-authinfrastructure--modelos-y-repositorios-sqlx)
16. [Feature `auth/application` — Servicios de aplicación](#16-feature-authapplication--servicios-de-aplicación)
17. [Feature `auth/presentation` — DTOs, handlers y rutas](#17-feature-authpresentation--dtos-handlers-y-rutas)
18. [Router raíz `routes/mod.rs`](#18-router-raíz-routesmodrs)
19. [Cómo ejecutar el proyecto](#19-cómo-ejecutar-el-proyecto)
20. [Buenas prácticas y errores comunes](#20-buenas-prácticas-y-errores-comunes)

---

## 1. Crear el proyecto

Abrí una terminal y ejecutá:

```bash
cargo new backend
cd backend
```

Esto crea la carpeta `backend/` con:

```
backend/
├── Cargo.toml
├── src/
│   └── main.rs
```

Vamos a transformar esta estructura básica en un backend completo.

---

## 2. `Cargo.toml` — Configuración de dependencias

Reemplazá el contenido de `Cargo.toml` con lo siguiente:

```toml
[package]
name = "backend"
version = "0.1.0"
edition = "2024"

[dependencies]
home = "=0.5.11"

# ─── Framework Web ───
axum = { version = "0.8.8", features = ["macros"] }
axum-extra = { version = "0.10", features = ["typed-header", "cookie"] }
tower-http = { version = "0.6.6", features = ["cors", "trace"] }
tokio = { version = "1", features = ["full"] }

# ─── Base de datos ───
sqlx = { version = "0.8.6", features = [
    "runtime-tokio-rustls",
    "postgres",
    "chrono",
    "uuid",
    "migrate",
    "macros"
] }

# ─── Cache Redis (opcional por ahora) ───
redis = { version = "0.27", features = ["aio", "tokio-comp", "json"] }

# ─── Serialización ───
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# ─── Autenticación ───
jsonwebtoken = { version = "10", default-features = false, features = ["rust_crypto"] }
bcrypt = "0.15"
time = "0.3"
cookie = "0.18"

# ─── Utilidades ───
uuid = { version = "1", features = ["v4", "v5", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
once_cell = "1.19"
dotenvy = "0.15"

# ─── Validación ───
validator = { version = "0.19", features = ["derive"] }

# ─── Async traits ───
async-trait = "0.1"

# ─── Logging ───
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[[bin]]
name = "server"
path = "src/main.rs"

[[bin]]
name = "seed"
path = "src/scripts/seed.rs"
```

### Explicación de cada dependencia

**`axum`** — Framework web de Rust, construido sobre Tower y Tokio. Usa el patrón de "extractores" para los handlers. La feature `macros` habilita `#[debug_handler]` para debugging.

**`axum-extra`** — Extensiones oficiales de Axum. La feature `cookie` integra `CookieJar` para manejar cookies de forma segura.

**`tower-http`** — Middlewares HTTP reutilizables. `cors` permite configurar CORS (Cross-Origin Resource Sharing). `trace` agrega logging automático de requests HTTP.

**`tokio`** — Runtime asíncrono de Rust. `full` habilita todas las features: networking, timers, signals, sync primitives, etc.

**`sqlx`** — Cliente PostgreSQL **nativo** (no es ORM). Escribís SQL plano. Features clave:
- `runtime-tokio-rustls`: usa Tokio como runtime y Rustls para TLS (no necesita OpenSSL).
- `postgres`: driver PostgreSQL.
- `chrono`, `uuid`: tipos para mapear timestamps y UUIDs.
- `migrate`: ejecutar migraciones SQL al iniciar la app.
- `macros`: las macros `query!` y `query_as!` que verifican el SQL en compilación.

**`redis`** — Cliente de Redis (opcional, para caché de sesiones o rate limiting).

**`serde`** + **`serde_json`** — Serialización/deserialización de Rust ↔ JSON. Axum la usa internamente para los extractores `Json<T>`.

**`jsonwebtoken`** — Crear y verificar JWT (JSON Web Tokens). Usamos el backend `rust_crypto` para evitar dependencia OpenSSL.

**`bcrypt`** — Hashing de contraseñas con algoritmo bcrypt. Costo por defecto: 10 iteraciones (~80ms por hash).

**`time`** y **`cookie`** — Dependencias de `axum-extra` para manejar cookies HTTP con fechas de expiración.

**`uuid`** — Generar UUIDs v4 (aleatorios). La feature `serde` permite serializarlos a JSON como strings.

**`chrono`** — Fechas y tiempos con zonas horarias (`DateTime<Utc>`). `serde` permite serializar fechas en JSON.

**`once_cell`** — Inicialización lazy de variables estáticas (`Lazy<T>`), útil para configuraciones globales.

**`dotenvy`** — Carga el archivo `.env` al inicio del programa.

**`validator`** — Validación de datos con macros derive (`#[validate(email)]`, `#[validate(length(min = 8))]`).

**`async-trait`** — Permite usar `async fn` en traits (Rust estable no lo soporta nativamente hasta edition 2024).

**`tracing`** y **`tracing-subscriber`** — Logging estructurado y spans para depuración. `env-filter` permite filtrar logs con `RUST_LOG=debug`.

**`[[bin]]`** — Definimos dos binarios:
- `cargo run --bin server` → inicia el servidor web.
- `cargo run --bin seed` → ejecuta un script para poblar la base de datos con datos de prueba.

---

## 3. Estructura de directorios

Creá todas las carpetas necesarias:

```bash
mkdir -p src/{routes,features/auth/{domain/contracts,application,infrastructure/{sqlx,models},presentation/{dto,handlers}},shared/{state,config,errors,security,helpers,validation},database/migrations}
```

La estructura resultante:

```
src/
├── main.rs
├── routes/
│   └── mod.rs
├── features/
│   ├── mod.rs
│   └── auth/
│       ├── mod.rs
│       ├── domain/
│       │   ├── mod.rs
│       │   ├── entities.rs
│       │   └── contracts/
│       │       ├── mod.rs
│       │       ├── user_repository.rs
│       │       ├── session_repository.rs
│       │       ├── verification_repository.rs
│       │       └── account_repository.rs
│       ├── application/
│       │   ├── mod.rs
│       │   ├── registration_service.rs
│       │   └── authentication_service.rs
│       ├── infrastructure/
│       │   ├── mod.rs
│       │   ├── mapper.rs
│       │   ├── models/
│       │   │   ├── mod.rs
│       │   │   ├── session.rs
│       │   │   └── credentials_account.rs
│       │   └── sqlx/
│       │       ├── mod.rs
│       │       ├── user_respository.rs
│       │       ├── session_repository.rs
│       │       ├── verification_repository.rs
│       │       └── account_repository.rs
│       └── presentation/
│           ├── mod.rs
│           ├── routes.rs
│           ├── dto/
│           │   ├── mod.rs
│           │   ├── request.rs
│           │   └── response.rs
│           └── handlers/
│               ├── mod.rs
│               ├── registration_handler.rs
│               ├── login_handler.rs
│               ├── logout_handler.rs
│               ├── refresh_handler.rs
│               ├── verify_email_handler.rs
│               ├── forgot_password_handler.rs
│               ├── reset_password_handler.rs
│               ├── session_handler.rs
│               └── resend_verification_handler.rs
├── shared/
│   ├── mod.rs
│   ├── state/
│   │   ├── mod.rs
│   │   └── app_state.rs
│   ├── config/
│   │   ├── mod.rs
│   │   ├── constants.rs
│   │   ├── cors.rs
│   │   ├── logger.rs
│   │   └── shutdown.rs
│   ├── errors/
│   │   ├── mod.rs
│   │   └── app_error.rs
│   ├── security/
│   │   ├── mod.rs
│   │   ├── jwt.rs
│   │   ├── password.rs
│   │   ├── cookies.rs
│   │   └── auth_guard.rs
│   ├── helpers/
│   │   ├── mod.rs
│   │   └── generate.rs
│   └── validation/
│       ├── mod.rs
│       └── validator.rs
└── database/
    ├── mod.rs
    ├── connection.rs
    └── migrations/
        └── 20260629234600_full_schema.sql
```

### ¿Por qué esta estructura?

Sigue **Domain-Driven Design (DDD)** adaptado a Rust:

- **`domain/`**: Entidades de negocio (`User`, `Verification`) y **contratos** (traits). Esta capa NO sabe nada de HTTP ni de bases de datos. Solo usa tipos de Rust y serde para serialización básica.

- **`application/`**: Casos de uso. Orquestan la lógica de negocio usando los traits del dominio. Tampoco saben de HTTP ni BD.

- **`infrastructure/`**: Implementaciones concretas de los traits (SQLx). También contiene los modelos específicos de base de datos (como `Session` y `CredentialsAccount`).

- **`presentation/`**: Capa HTTP. Handlers de Axum, DTOs (Data Transfer Objects), definición de rutas.

- **`shared/`**: Código transversal que cualquier capa puede usar: configuración, errores, seguridad, helpers.

- **`database/`**: Conexión a la BD y migraciones.

Esta organización permite que cada feature (auth, products, sales) sea independiente y tenga sus propias capas, en lugar de tener monstruosos directorios `models/`, `controllers/`, `services/` con 30 archivos mezclados.

---

## 4. Archivo `.env` — Variables de entorno

Creá `.env` en la raíz del proyecto:

```bash
touch .env
```

Contenido:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mi_negocio
FRONTEND_URL=http://localhost:3000
JWT_SECRET=mi-clave-secreta-super-segura-cambiar-en-produccion
JWT_REFRESH_SECRET=mi-clave-refresh-super-segura-cambiar-en-produccion
NODE_ENV=development
```

Explicación de cada variable:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión a PostgreSQL. Formato: `postgres://usuario:password@host:puerto/base_de_datos` |
| `FRONTEND_URL` | URL del frontend (para CORS). En desarrollo `http://localhost:3000` |
| `JWT_SECRET` | Clave secreta para firmar access tokens JWT (15 min de vida) |
| `JWT_REFRESH_SECRET` | Clave secreta para firmar refresh tokens JWT (7 días de vida) |
| `NODE_ENV` | Entorno: `development` o `production`. Cambia comportamiento de cookies (secure, sameSite) |

> **Importante**: Agregá `.env` a tu `.gitignore`. Nunca subas secretos a Git.

---

## 5. `src/main.rs` — Punto de entrada

```rust
pub mod database;
pub mod features;
pub mod routes;
pub mod shared;

use axum::Router;
use dotenvy::dotenv;
use sqlx::{Pool, Postgres};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::net::TcpListener;
use tower_http::{
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

use crate::{
    database::connection::create_pool,
    shared::config::shutdown::shutdown_signal,
    shared::state::app_state::AppState,
};

const HOST: IpAddr = IpAddr::V4(Ipv4Addr::UNSPECIFIED);
const PORT: u16 = 4001;

#[tokio::main]
async fn main() {
    // ─── 1. Cargar variables de entorno ───
    dotenv().ok();

    // ─── 2. Inicializar logger ───
    shared::config::logger::init();

    // ─── 3. Configurar CORS ───
    let cors: CorsLayer = shared::config::cors::init();

    // ─── 4. Definir dirección de escucha ───
    let addr: SocketAddr = SocketAddr::new(HOST, PORT);

    // ─── 5. Crear pool de conexiones a la BD ───
    let db: Pool<Postgres> = create_pool().await.expect("Error al conectar a la base de datos");

    // ─── 6. Construir router con estado y middlewares ───
    let router: Router = routes::create_routes()
        .with_state(AppState { db })
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        );

    // ─── 7. Escuchar en el puerto ───
    let listener: TcpListener = TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        panic!(
            "No se pudo bindear al puerto {PORT} — {e}.\n  ¿Ya hay otro proceso corriendo? \
             Ejecutá:\n\n    lsof -i :{PORT}\n    kill -9 <PID>\n"
        )
    });

    tracing::info!("Servidor escuchando en http://{}", &addr);

    // ─── 8. Iniciar servidor con graceful shutdown ───
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap_or_else(|e| {
            panic!("Error al servir el servidor: {e}");
        });
}
```

### Explicación bloque por bloque

**Líneas 1-4 — Declaración de módulos:**
```rust
pub mod database;
pub mod features;
pub mod routes;
pub mod shared;
```
Cada `pub mod` le dice a Rust que busque una carpeta (o archivo) con ese nombre dentro de `src/`. Al ser `pub`, otros módulos pueden importarlos con `use crate::database::...`.

**Líneas 15-16 — Constantes de compilación:**
```rust
const HOST: IpAddr = IpAddr::V4(Ipv4Addr::UNSPECIFIED);
const PORT: u16 = 4001;
```
- `UNSPECIFIED` equivale a `0.0.0.0`: escucha en todas las interfaces de red.
- `PORT` está en `4001` para no chocar con el frontend que suele usar `3000`.

**Línea 18 — `#[tokio::main]`:**
```rust
#[tokio::main]
async fn main() {
```
Esta macro transforma el `main` asíncrono en un `main` síncrono que:
1. Crea un runtime Tokio multi-hilo (por la feature `full`).
2. Ejecuta la función async en ese runtime.
3. Espera a que termine.

Sin esta macro, tendrías que escribir:
```rust
fn main() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        // código async
    });
}
```

**Línea 21 — Cargar variables de entorno:**
```rust
dotenv().ok();
```
`dotenvy::dotenv()` lee el archivo `.env` del directorio actual y carga las variables en el proceso. `.ok()` ignora el error si no existe el archivo (por ejemplo, en producción las variables ya están en el entorno del sistema).

**Línea 24 — Inicializar logger:**
```rust
shared::config::logger::init();
```
Configura `tracing-subscriber` para mostrar logs formateados. Debe llamarse una sola vez al inicio.

**Línea 27 — Inicializar CORS:**
```rust
let cors: CorsLayer = shared::config::cors::init();
```
Crea la capa de CORS con la configuración definida en `shared::config::cors::init()`.

**Línea 33 — Pool de base de datos:**
```rust
let db: Pool<Postgres> = create_pool().await.expect("Error al conectar a la base de datos");
```
Crea un pool de conexiones PostgreSQL. `create_pool()` intenta conectar inmediatamente, por eso usamos `.await`. Si falla, `expect()` detiene el programa con un mensaje claro.

**Líneas 36-44 — Router con estado y middlewares:**
```rust
let router: Router = routes::create_routes()
    .with_state(AppState { db })
    .layer(cors)
    .layer(TraceLayer::new_for_http()...);
```
- `routes::create_routes()` devuelve un `Router<AppState>` con todas las rutas definidas.
- `.with_state(AppState { db })` inyecta el pool de BD como estado compartido.
- `.layer(cors)` y `.layer(trace)` envuelven el router con middlewares.

El orden de los layers importa: las requests entran por el último layer agregado (`trace`) y luego pasan al anterior (`cors`), luego al router. Las respuestas viajan en orden inverso (router → cors → trace).

**Líneas 47-57 — Servidor con graceful shutdown:**
```rust
let listener: TcpListener = TcpListener::bind(&addr).await.unwrap_or_else(|e| {
    panic!("No se pudo bindear al puerto {PORT} — {e}.\n ...")
});

axum::serve(listener, router)
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap_or_else(|e| {
        panic!("Error al servir el servidor: {e}");
    });
```
- `TcpListener::bind` abre un socket TCP.
- `axum::serve` comienza a servir requests HTTP.
- `.with_graceful_shutdown(shutdown_signal())` configura el apagado graceful: cuando se recibe Ctrl+C o SIGTERM, el servidor deja de aceptar nuevas conexiones pero termina de procesar las existentes antes de cerrarse.

---

## 6. Módulo `shared/state` — Estado compartido `AppState`

### `src/shared/state/mod.rs`

```rust
pub mod app_state;
```

Este archivo declara el submódulo `app_state`. Sin esto, Rust no sabe que `app_state.rs` existe.

### `src/shared/state/app_state.rs`

```rust
use sqlx::PgPool;

/// Estado compartido de la aplicación.
/// Se inyecta en todos los handlers de Axum.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}
```

### Explicación

**`#[derive(Clone)]`**: Axum requiere que el estado implemente `Clone` porque necesita clonarlo potencialmente para cada request. `PgPool` internamente usa `Arc` (puntero atómico referenciado), así que clonar `AppState` solo incrementa un contador — es barato.

**`pub db: PgPool`**: El pool de conexiones a PostgreSQL. Es `pub` porque los handlers acceden a él directamente con `state.db`.

**¿Por qué no usar `Arc<AppState>`?** Es una alternativa válida:
```rust
pub type SharedState = Arc<AppState>;
```
Luego los handlers extraen con `State(state): State<Arc<AppState>>`. La ventaja es que funciona incluso si `AppState` no implementa `Clone`. La desventaja es que los handlers son más verbosos. En este proyecto, `PgPool` ya es clonable, así que usamos `Clone` directo.

---

## 7. Módulo `shared/config` — Configuración global

### `src/shared/config/mod.rs`

```rust
pub mod constants;
pub mod cors;
pub mod logger;
pub mod shutdown;
```

Declara los cuatro submódulos de configuración.

### `src/shared/config/constants.rs`

```rust
use std::env;
use once_cell::sync::Lazy;

/// URL de conexión a PostgreSQL. Se lee de DATABASE_URL.
pub static DATABASE_URL: Lazy<String> =
    Lazy::new(|| env::var("DATABASE_URL").expect("DATABASE_URL no está definida"));

/// URL del frontend (para CORS). Se lee de FRONTEND_URL.
pub static FRONTEND_URL: Lazy<String> =
    Lazy::new(|| env::var("FRONTEND_URL").expect("FRONTEND_URL no está definida"));

/// Clave secreta para firmar JWT de acceso. Se lee de JWT_SECRET.
pub static JWT_SECRET: Lazy<String> =
    Lazy::new(|| env::var("JWT_SECRET").expect("JWT_SECRET no está definida"));

/// Clave secreta para firmar JWT de refresco. Se lee de JWT_REFRESH_SECRET.
pub static JWT_REFRESH_SECRET: Lazy<String> =
    Lazy::new(|| env::var("JWT_REFRESH_SECRET").expect("JWT_REFRESH_SECRET no está definida"));

/// Entorno: "development" o "production". Por defecto "development".
pub static NODE_ENV: Lazy<String> =
    Lazy::new(|| env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()));
```

### Explicación

**`once_cell::sync::Lazy<T>`**: Es como `lazy_static!` pero más moderno. Garantiza que:
- La inicialización ocurre **una sola vez** (thread-safe).
- Ocurre **la primera vez** que se accede a la variable, no al inicio del programa.

El flujo es:
1. `dotenv()` carga las variables en el entorno.
2. Cuando el código toca `DATABASE_URL` por primera vez, `Lazy` ejecuta `env::var("DATABASE_URL")`.
3. Si la variable no existe, `expect()` lanza panic con un mensaje claro (fast fail).
4. El valor se cachea para siempre.

**¿Por qué no pasar estas configuraciones por `AppState`?** Porque se usan en funciones que no reciben `AppState`, como `jwt.rs` y `cookies.rs`. Las `static` globales son accesibles desde cualquier lugar.

**`NODE_ENV` con `unwrap_or_else`**: Esta variable es opcional. Si no está definida, asumimos "development". Esto es útil porque en desarrollo local no necesitás configurarla.

### `src/shared/config/cors.rs`

```rust
use axum::http;
use tower_http::cors::CorsLayer;

use crate::shared::config::constants::FRONTEND_URL;

pub fn init() -> CorsLayer {
    CorsLayer::new()
        // Permitir solo el origen del frontend
        .allow_origin(FRONTEND_URL.parse::<http::HeaderValue>().unwrap())
        // Métodos HTTP permitidos
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::PATCH,
            http::Method::DELETE,
        ])
        // Headers permitidos
        .allow_headers([http::header::CONTENT_TYPE, http::header::AUTHORIZATION])
        // Permitir envío de cookies (necesario para httpOnly cookies)
        .allow_credentials(true)
}
```

### Explicación

CORS (Cross-Origin Resource Sharing) es un mecanismo de seguridad del navegador. Sin CORS, una página en `http://localhost:3000` no puede hacer fetch a `http://localhost:4001` porque son orígenes diferentes (cambia el puerto).

**`allow_origin(FRONTEND_URL.parse()...)`**: Solo permitimos el origen específico de nuestro frontend. Usar `AllowOrigin::any()` con `allow_credentials(true)` es inseguro.

**`allow_methods(...)`**: Los métodos HTTP que nuestra API soporta.

**`allow_headers([CONTENT_TYPE, AUTHORIZATION])`**: 
- `Content-Type` es necesario para requests con body JSON.
- `Authorization` es necesario para enviar tokens JWT en el header.

**`allow_credentials(true)`**: Permite que el navegador envíe cookies en requests cross-origin. Necesario para nuestras cookies httpOnly de autenticación.

### `src/shared/config/logger.rs`

```rust
use tracing_subscriber::{
    EnvFilter,
    fmt,
    fmt::format::FmtSpan,
};

pub fn init() {
    fmt()
        // Filtro por RUST_LOG. Si no está definida, usa "info"
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        // Formato compacto (una línea por log)
        .compact()
        // No mostrar el módulo de origen
        .with_target(false)
        // No mostrar eventos de span (enter/exit)
        .with_span_events(FmtSpan::NONE)
        // Registrar como subscriber global (solo una vez)
        .init();
}
```

### Explicación

**`fmt()`**: Crea un subscriber con formato legible (no JSON). Alternativa: `json()` para logs estructurados en producción.

**`EnvFilter`**: Lee la variable `RUST_LOG` para filtrar logs:
```
RUST_LOG=info cargo run          # info, warn, error
RUST_LOG=debug cargo run         # +debug
RUST_LOG=trace cargo run         # +trace
RUST_LOG=sqlx=warn cargo run     # sqlx solo warn, el resto info
```

**`compact()`**: Una línea por log. Alternativas: `pretty()` (multi-línea, más legible), `json()` (estructurado).

**`with_target(false)`**: Oculta el nombre del módulo que generó el log. Con `true` verías `INFO backend::routes::handler: User logged in`. Con `false`: `INFO User logged in`.

**`init()`**: Registra el subscriber como global. Solo puede llamarse una vez. Si se llama dos veces, panic.

### `src/shared/config/shutdown.rs`

```rust
use tokio::signal;

/// Espera una señal de terminación (Ctrl+C o SIGTERM)
/// para iniciar el apagado graceful del servidor.
pub async fn shutdown_signal() {
    // Señal Ctrl+C (enviada por el terminal)
    let ctrl_c = tokio::signal::ctrl_c();

    // Señal SIGTERM (enviada por orquestadores como Docker/Kubernetes)
    let mut term_signal = tokio::signal::unix::signal(
        tokio::signal::unix::SignalKind::terminate(),
    )
    .expect("No se pudo instalar el handler de SIGTERM");

    // Esperar la primera señal que llegue
    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Ctrl+C recibido — cerrando servidor...");
        }
        _ = term_signal.recv() => {
            tracing::info!("SIGTERM recibido — cerrando servidor...");
        }
    }

    // Pequeña pausa para que los logs se vean antes de morir
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
}
```

### Explicación

**`tokio::select!`**: Espera concurrentemente múltiples futuras. La primera que complete "gana" y las otras se cancelan.

**Ctrl+C**: Señal que envía el terminal cuando presionás Ctrl+C.

**SIGTERM**: Señal que envían los orquestadores (Docker, Kubernetes, systemd) para detener el proceso de forma graceful. No está disponible en Windows (solo Unix).

**`tokio::signal::unix::signal(...)`**: Solo compila en sistemas Unix (Linux, macOS). En Windows necesitarías una alternativa diferente.

**`sleep(50ms)`**: Pequeña pausa para que los logs de "cerrando servidor" se impriman antes de que el proceso termine.

---

## 8. Módulo `shared/errors` — Manejo de errores

### `src/shared/errors/mod.rs`

```rust
pub mod app_error;
```

### `src/shared/errors/app_error.rs`

```rust
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use validator::ValidationErrors;

/// Error personalizado de la aplicación.
/// Cada variante representa un tipo de error HTTP.
#[derive(Debug)]
#[allow(dead_code)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    InternalServerError(String),
    Unauthorized(String),
    Forbidden(String),
    Conflict(String),
}

/// Implementación de IntoResponse para que Axum pueda
/// convertir AppError en respuestas HTTP automáticamente.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message_error) = match self {
            AppError::NotFound(message) => (
                StatusCode::NOT_FOUND,
                json!({"error": "not_found", "message": message}),
            ),
            AppError::InternalServerError(message) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({"error": "internal_server_error", "message": message}),
            ),
            AppError::Unauthorized(message) => (
                StatusCode::UNAUTHORIZED,
                json!({"error": "unauthorized", "message": message}),
            ),
            AppError::Forbidden(message) => (
                StatusCode::FORBIDDEN,
                json!({"error": "forbidden", "message": message}),
            ),
            AppError::BadRequest(message) => (
                StatusCode::BAD_REQUEST,
                json!({"error": "bad_request", "message": message}),
            ),
            AppError::Conflict(message) => (
                StatusCode::CONFLICT,
                json!({"error": "conflict", "message": message}),
            ),
        };
        (status, Json(message_error)).into_response()
    }
}

/// Convierte errores de serde_json a AppError.
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::InternalServerError(format!("JSON error: {}", err))
    }
}

/// Convierte errores de SQLx a AppError.
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::InternalServerError(format!("Database error: {}", err))
    }
}

/// Convierte errores de validación (validator) a AppError.
/// Extrae todos los mensajes de error y los concatena.
impl From<ValidationErrors> for AppError {
    fn from(err: ValidationErrors) -> Self {
        let message = err
            .field_errors()
            .iter()
            .flat_map(|(field, errors)| {
                errors.iter().map(move |e| {
                    let msg = e
                        .message
                        .as_ref()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| format!("{} is invalid", field));
                    format!("{}: {}", field, msg)
                })
            })
            .collect::<Vec<_>>()
            .join("; ");

        AppError::BadRequest(message)
    }
}

/// Convierte errores de jsonwebtoken a AppError.
impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::InternalServerError(format!("JWT error: {}", err))
    }
}
```

### Explicación bloque por bloque

**`AppError` enum** — Seis variantes que cubren los códigos de error HTTP más comunes:
- `NotFound` → 404
- `BadRequest` → 400
- `InternalServerError` → 500
- `Unauthorized` → 401
- `Forbidden` → 403
- `Conflict` → 409

**`IntoResponse for AppError`** — Este es el corazón del sistema de errores. Cuando un handler devuelve `Err(AppError::NotFound(...))`, Axum automáticamente llama a `into_response()` para convertirlo en una respuesta HTTP. La respuesta tiene:
1. El código HTTP correspondiente.
2. Un body JSON consistente: `{"error": "not_found", "message": "User not found"}`.

**`From<sqlx::Error>`** — Sin esta conversión, no podrías usar `?` en operaciones de BD dentro de handlers que devuelven `Result<..., AppError>`. El operador `?` intenta convertir el error automáticamente usando `From`, y nuestra implementación envuelve el error de SQLx en `AppError::InternalServerError`.

**`From<ValidationErrors>`** — Cuando `payload.validate()?` falla, el error de validator se convierte automáticamente a `AppError::BadRequest` con todos los mensajes de error concatenados.

El método `field_errors()` devuelve un mapa de `campo → [Error, ...]`. Iteramos sobre cada campo y cada error, extrayendo el mensaje (o generando uno por defecto), y los unimos con "; ". Ejemplo:
```
"email: Invalid email format; password: Password must be at least 8 characters"
```

---

## 9. Módulo `shared/security` — JWT, passwords, cookies, auth guards

### `src/shared/security/mod.rs`

```rust
pub mod auth_guard;
pub mod cookies;
pub mod jwt;
pub mod password;
```

### `src/shared/security/jwt.rs`

```rust
use jsonwebtoken::{
    decode, encode, errors::Error as JwtError, DecodingKey, EncodingKey, Header, Validation,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::shared::config::constants::{JWT_REFRESH_SECRET, JWT_SECRET};

/// Duración del access token: 15 minutos
const ACCESS_TOKEN_EXPIRY_SECS: i64 = 900;

/// Duración del refresh token: 7 días
const REFRESH_TOKEN_EXPIRY_SECS: i64 = 604800;

/// Claims del access token JWT.
/// Contiene información del usuario para cada request autenticado.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub sub: String,   // subject → user_id
    pub email: String,
    pub role: String,
    pub jti: String,   // JWT ID → identificador único del token
    pub exp: usize,    // expiration timestamp
    pub iat: usize,    // issued at timestamp
}

/// Claims del refresh token JWT.
/// Solo contiene lo mínimo necesario: user_id y jti.
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub sub: String,
    pub jti: String,
    pub exp: usize,
    pub iat: usize,
}

/// Par de tokens: access y refresh.
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

/// Genera un par de tokens (access + refresh) para un usuario.
pub fn generate_tokens(user_id: &str, email: &str, role: &str) -> Result<TokenPair, JwtError> {
    let now = OffsetDateTime::now_utc().unix_timestamp() as usize;

    // JTI único por par de tokens
    let jti = Uuid::new_v4().to_string();

    // Access token: contiene info del usuario, expira en 15 min
    let access_claims = AccessTokenClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        jti: jti.clone(),
        iat: now,
        exp: now + ACCESS_TOKEN_EXPIRY_SECS as usize,
    };

    // Refresh token: solo user_id y jti, expira en 7 días
    let refresh_claims = RefreshTokenClaims {
        sub: user_id.to_string(),
        jti,
        iat: now,
        exp: now + REFRESH_TOKEN_EXPIRY_SECS as usize,
    };

    // Firmar access token con JWT_SECRET
    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )?;

    // Firmar refresh token con JWT_REFRESH_SECRET (clave diferente)
    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(JWT_REFRESH_SECRET.as_bytes()),
    )?;

    Ok(TokenPair {
        access_token,
        refresh_token,
    })
}

/// Verifica un access token y devuelve sus claims.
pub fn verify_access_token(token: &str) -> Result<AccessTokenClaims, JwtError> {
    let data = decode::<AccessTokenClaims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &Validation::default(),
    )?;

    Ok(data.claims)
}

/// Verifica un refresh token y devuelve sus claims.
pub fn verify_refresh_token(token: &str) -> Result<RefreshTokenClaims, JwtError> {
    let data = decode::<RefreshTokenClaims>(
        token,
        &DecodingKey::from_secret(JWT_REFRESH_SECRET.as_bytes()),
        &Validation::default(),
    )?;

    Ok(data.claims)
}
```

### Explicación

**Access Token (15 min)**: Contiene `sub` (user_id), `email`, `role`. Se envía en cada request autenticado (header `Authorization: Bearer <token>` o cookie). Su corta duración minimiza el impacto si es robado.

**Refresh Token (7 días)**: Solo contiene `sub` y `jti` (JWT ID). Se usa exclusivamente para obtener nuevos access tokens. Se almacena en la tabla `session` de la BD y se envía en una cookie httpOnly.

**Dos claves secretas diferentes**: `JWT_SECRET` para access tokens, `JWT_REFRESH_SECRET` para refresh tokens. Si una se ve comprometida, la otra sigue siendo segura.

**JTI**: Identificador único por par de tokens. Permite revocar tokens específicos (por ejemplo, cerrar sesión desde un dispositivo en particular). También se usa para **token rotation**: cuando refrescás, el viejo refresh token se invalida y se crea uno nuevo con diferente JTI.

**`EncodingKey::from_secret`**: Usamos HMAC-SHA256 (simétrico). La misma clave se usa para firmar y verificar. En producción, podrías usar RSA (asimétrico) si múltiples servicios necesitan verificar tokens sin tener la clave secreta.

**`Validation::default()`**: Verifica:
- Que la firma sea válida.
- Que `exp` no haya expirado.
- Que `iat` no sea una fecha futura.

### `src/shared/security/password.rs`

```rust
use bcrypt::{hash, verify};

/// Costo de bcrypt: 10 iteraciones (~80ms en hardware moderno).
const BCRYPT_COST: u32 = 10;

use crate::shared::errors::app_error::AppError;

/// Hashea una contraseña con bcrypt.
pub fn hash_password(password: &str) -> Result<String, AppError> {
    hash(password, BCRYPT_COST)
        .map_err(|e| AppError::InternalServerError(format!("Error hasheando password: {}", e)))
}

/// Verifica una contraseña contra un hash de bcrypt.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash)
        .map_err(|e| AppError::InternalServerError(format!("Error verificando password: {}", e)))
}
```

### Explicación

**bcrypt**: Algoritmo de hashing diseñado específicamente para contraseñas:
- Es **lento** intencionalmente (dificulta ataques de fuerza bruta).
- Incluye **salt** automáticamente (cada hash usa un salt diferente; no hay que almacenarlo por separado).
- Tiene un parámetro de **costo** que se puede aumentar a medida que el hardware mejora.

**Costo 10**: ~80ms por hash en hardware moderno. Es el valor por defecto recomendado. Costo 12+ sería más seguro pero el usuario notaría la demora en el login.

**`map_err`**: Convierte errores de bcrypt (como contraseñas inválidas) a nuestro tipo `AppError`.

### `src/shared/security/cookies.rs`

```rust
use axum_extra::extract::CookieJar;
use cookie::Cookie;
use time::Duration;

use crate::shared::config::constants::NODE_ENV;

const ACCESS_TOKEN_MAX_AGE: i64 = 900;     // 15 minutos
const REFRESH_TOKEN_MAX_AGE: i64 = 604800; // 7 días

/// Determina si estamos en producción (para cookies secure y same_site).
fn is_production() -> bool {
    *NODE_ENV == "production"
}

/// Establece las cookies de autenticación (accessToken y refreshToken).
pub fn set_auth_cookies(jar: CookieJar, access_token: &str, refresh_token: &str) -> CookieJar {
    let secure = is_production();
    let same_site = if secure {
        cookie::SameSite::Strict
    } else {
        cookie::SameSite::Lax
    };

    // Cookie del access token (15 min)
    let access_cookie = Cookie::build(("accessToken", access_token.to_owned()))
        .path("/")
        .http_only(true)       // No accesible desde JavaScript
        .secure(secure)        // Solo HTTPS en producción
        .max_age(Duration::seconds(ACCESS_TOKEN_MAX_AGE))
        .same_site(same_site)  // Strict en prod, Lax en dev
        .build();

    // Cookie del refresh token (7 días)
    let refresh_cookie = Cookie::build(("refreshToken", refresh_token.to_owned()))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(REFRESH_TOKEN_MAX_AGE))
        .same_site(same_site)
        .build();

    jar.add(access_cookie).add(refresh_cookie)
}

/// Extrae el accessToken de un header Cookie crudo.
/// Ej: "accessToken=abc; refreshToken=def" → Some("abc")
pub fn extract_access_token(cookie_header: &str) -> Option<String> {
    cookie_header
        .split(';')
        .filter_map(|c| {
            let c = c.trim();
            c.strip_prefix("accessToken=")
        })
        .next()
        .map(|s| s.to_string())
}

/// Elimina las cookies de autenticación (para logout).
pub fn clear_auth_cookies(jar: CookieJar) -> CookieJar {
    let secure = is_production();

    let access_cookie = Cookie::build(("accessToken", ""))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(0))  // max_age 0 → el navegador la elimina
        .build();

    let refresh_cookie = Cookie::build(("refreshToken", ""))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(0))
        .build();

    jar.add(access_cookie).add(refresh_cookie)
}
```

### Explicación

**Propiedades de seguridad de las cookies:**

| Propiedad | Valor | ¿Por qué? |
|---|---|---|
| `http_only(true)` | No accesible desde JS | Previene XSS: un script malicioso no puede leer el token |
| `secure(true en prod)` | Solo HTTPS | En producción, la cookie solo se envía por conexiones cifradas |
| `same_site(Strict)` | No cross-site | Previene CSRF: un sitio malicioso no puede hacer requests autenticados |
| `path("/")` | Todo el sitio | La cookie se envía a todas las rutas de la API |

**`CookieJar`**: Es un extractor de Axum que recolecta las cookies de la request y permite modificarlas para la response. Se usa como:
```rust
// En el handler:
fn login_handler(jar: CookieJar, ...) -> Result<(StatusCode, CookieJar, Json<...>), AppError> {
    let jar = set_auth_cookies(jar, &token.access_token, &token.refresh_token);
    Ok((StatusCode::OK, jar, Json(response)))
}
```

**`extract_access_token`**: Se usa en el middleware de autenticación (donde no tenemos acceso a `CookieJar`, solo al header `Cookie` crudo). Parsea el header manualmente para extraer el token.

### `src/shared/security/auth_guard.rs`

```rust
use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::shared::security::jwt;

use super::cookies::extract_access_token;

/// Middleware para rutas que requieren admin autenticado.
/// Lee el token del header Authorization: Bearer o de la cookie accessToken.
pub async fn admin_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    // 1. Extraer token (Bearer header o cookie)
    let token = extract_bearer_token(&req)
        .or_else(|| extract_cookie_token(&req))
        .ok_or_else(|| {
            AppErrorJson::unauthorized("Authentication required").into_response()
        })?;

    // 2. Verificar token
    let claims = jwt::verify_access_token(&token).map_err(|_| {
        AppErrorJson::unauthorized("Invalid or expired token").into_response()
    })?;

    // 3. Verificar rol admin
    if claims.role != "admin" {
        return Err(AppErrorJson::forbidden("Admin access required").into_response());
    }

    // 4. Insertar claims en las extensiones de la request
    req.extensions_mut().insert(claims);

    // 5. Continuar con el siguiente handler
    Ok(next.run(req).await)
}

/// Extrae el token del header Authorization: Bearer <token>
fn extract_bearer_token(req: &Request<Body>) -> Option<String> {
    req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// Extrae el token de la cookie accessToken
fn extract_cookie_token(req: &Request<Body>) -> Option<String> {
    let cookie_header = req.headers().get("Cookie")?.to_str().ok()?;
    extract_access_token(cookie_header)
}

/// Middleware para rutas que requieren usuario autenticado (cualquier rol).
pub async fn require_auth_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    let token = extract_bearer_token(&req)
        .or_else(|| extract_cookie_token(&req))
        .ok_or_else(|| {
            AppErrorJson::unauthorized("Authentication required").into_response()
        })?;

    let claims = jwt::verify_access_token(&token).map_err(|_| {
        AppErrorJson::unauthorized("Invalid or expired token").into_response()
    })?;

    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

/// Helper para devolver errores JSON con el mismo formato.
struct AppErrorJson {
    status: axum::http::StatusCode,
    message: String,
}

impl AppErrorJson {
    fn unauthorized(message: &str) -> Self {
        Self {
            status: axum::http::StatusCode::UNAUTHORIZED,
            message: message.to_string(),
        }
    }

    fn forbidden(message: &str) -> Self {
        Self {
            status: axum::http::StatusCode::FORBIDDEN,
            message: message.to_string(),
        }
    }
}

impl IntoResponse for AppErrorJson {
    fn into_response(self) -> Response {
        let body = serde_json::json!({ "message": self.message });
        (self.status, axum::Json(body)).into_response()
    }
}
```

### Explicación

**¿Cómo funciona un middleware en Axum?**
1. Recibe la request y `next` (el siguiente middleware o handler).
2. Hace algo con la request (validar, transformar, etc.).
3. Llama a `next.run(req)` para pasar al siguiente.
4. Devuelve la respuesta (o error).

**Dos middlewares**: `require_auth_middleware` (cualquier usuario autenticado) y `admin_middleware` (solo admins). Son casi idénticos, pero `admin_middleware` además verifica `claims.role == "admin"`.

**Extracción del token**: Intentamos dos fuentes:
1. Header `Authorization: Bearer <token>` → para requests de JavaScript (fetch/Axios).
2. Cookie `accessToken` → para requests de navegación o cuando el token se envía como cookie.

**Extensiones**: `req.extensions_mut().insert(claims)` guarda los claims en la request. Luego el handler los recupera con:
```rust
Extension(claims): Extension<AccessTokenClaims>
```

**`AppErrorJson`**: Estructura auxiliar para devolver errores desde el middleware. No podemos usar `AppError` porque el middleware devuelve `Result<Response, Response>` (no `Result<..., AppError>`).

---

## 10. Módulo `shared/helpers` — Utilidades

### `src/shared/helpers/mod.rs`

```rust
pub mod generate;
```

### `src/shared/helpers/generate.rs`

```rust
/// Genera un código de verificación alfanumérico de 6 caracteres.
/// Se usa para verificación de email y recuperación de contraseña.
pub fn generate_code() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    // Usar el tiempo actual como semilla
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    let hash = hasher.finish();

    // Caracteres permitidos (sin vocales para evitar palabras ofensivas)
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let mut code = String::with_capacity(6);
    let mut h = hash;

    for _ in 0..6 {
        code.push(CHARS[(h as usize) % CHARS.len()] as char);
        h /= CHARS.len() as u64;
    }

    code
}
```

### Explicación

Este generador de códigos usa un **hash del timestamp actual** para producir códigos de 6 caracteres. No es criptográficamente aleatorio (no deberías usarlo para tokens de sesión), pero es suficiente para códigos de verificación de email de corta duración.

**Alternativa**: Usar `rand` crate para aleatoriedad criptográfica. Sería más seguro pero agrega otra dependencia.

**Caracteres sin vocales**: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` — al no tener vocales, evitamos generar palabras ofensivas accidentales.

---

## 11. Módulo `shared/validation` — Validación

### `src/shared/validation/mod.rs`

```rust
pub mod validator;
```

### `src/shared/validation/validator.rs`

Este archivo está vacío en el proyecto original. Se creó como预留 para validadores personalizados. Podrías agregar funciones como:

```rust
// Ejemplo de validador personalizado (opcional)
pub fn validar_telefono(telefono: &str) -> bool {
    telefono.len() >= 10 && telefono.chars().all(|c| c.is_ascii_digit())
}
```

---

## 12. Módulo `database` — Conexión y migraciones

### `src/database/mod.rs`

```rust
pub mod connection;
```

### `src/database/connection.rs`

```rust
use sqlx::{PgPool, postgres::PgPoolOptions};

use crate::shared::config::constants::DATABASE_URL;

/// Crea un pool de conexiones a PostgreSQL.
pub async fn create_pool() -> Result<PgPool, sqlx::Error> {
    tracing::info!("Conectando a la base de datos...");

    PgPoolOptions::new()
        .max_connections(10)       // Máximo 10 conexiones simultáneas
        .connect(&DATABASE_URL)    // URL de conexión
        .await
}
```

### Explicación

**`PgPoolOptions`**: Builder para configurar el pool.

**`max_connections(10)`**: Máximo de conexiones abiertas simultáneamente. En PostgreSQL, cada conexión es un proceso separado, así que no abuses del número. 10-20 es un buen punto de partida.

**`.connect(&DATABASE_URL)`**: Intenta conectar a la base de datos. La URL tiene formato `postgres://usuario:password@host:puerto/base_de_datos`.

**¿Qué hace el pool?**: Mantiene N conexiones abiertas. Cuando un handler necesita hacer una query, toma una conexión del pool, la usa, y la devuelve. Esto es mucho más eficiente que abrir y cerrar una conexión por cada request.

---

## 13. Migración SQL — Esquema completo de base de datos

### `src/database/migrations/20260629234600_full_schema.sql`

```sql
-- Migration: Esquema completo del sistema POS
-- Crea todos los enums, tablas, índices y claves foráneas

-- ─── Enums ───

-- Rol de usuario: admin (dueño/gerente) o cajero (empleado)
CREATE TYPE "ROLE" AS ENUM ('admin', 'cajero');

-- Tipo de unidad para productos
CREATE TYPE "UNIT_TYPE" AS ENUM ('unidad', 'paquete', 'caja', 'bolsa', 'botella', 'lata', 'sobre', 'barra', 'rollo', 'galon', 'ristra');

-- ─── Tabla: users ───
-- Almacena los datos básicos del usuario (sin contraseña).
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "image" TEXT,
    "role" "ROLE" NOT NULL DEFAULT 'cajero',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,            -- Soft delete

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ─── Tabla: session ───
-- Almacena sesiones activas (refresh tokens).
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,                -- El refresh token JWT
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- ─── Tabla: account ───
-- Almacena credenciales de autenticación.
-- Soporta múltiples providers (ej: credentials, google, github).
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,           -- Email o ID del provider
    "provider_id" TEXT NOT NULL,          -- 'credentials', 'google', etc.
    "user_id" UUID,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,                      -- Solo para provider 'credentials'
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- ─── Tabla: verification ───
-- Almacena códigos de verificación (email, reset password).
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,           -- Email o "reset:email"
    "value" TEXT NOT NULL,                -- El código
    "expires_at" TIMESTAMPTZ NOT NULL,    -- Fecha de expiración
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- ─── Tablas de negocio (productos, ventas, etc.) ───

-- Categorías de productos
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Proveedores
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- Productos
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "unit_type" "UNIT_TYPE",
    "unit_quantity" INTEGER,
    "category_id" UUID,
    "supplier_id" UUID,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- Servicios ofrecidos
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- Productos que componen un servicio
CREATE TABLE "service_products" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "service_products_pkey" PRIMARY KEY ("id")
);

-- Ventas
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "amount_received" DECIMAL(10,2),
    "change_given" DECIMAL(10,2),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- Servicios vendidos en una venta
CREATE TABLE "sale_services" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_services_pkey" PRIMARY KEY ("id")
);

-- Productos de servicios vendidos
CREATE TABLE "sale_service_products" (
    "id" UUID NOT NULL,
    "sale_service_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "affects_price" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_service_products_pkey" PRIMARY KEY ("id")
);

-- Items (productos individuales) vendidos en una venta
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "tax_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- Lotes de inventario (entradas/salidas)
CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "movement_type" TEXT NOT NULL,
    "supplier_id" UUID,
    "notes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- Items de cada lote de inventario
CREATE TABLE "inventory_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batch_items_pkey" PRIMARY KEY ("id")
);

-- Movimientos de inventario individuales
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "batch_id" UUID,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- Configuración del negocio
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mi Negocio',
    "address" TEXT,
    "phone" TEXT,
    "tax_rate" DECIMAL(10,2) NOT NULL DEFAULT 16,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "ticket_footer" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- ─── Índices ───
-- Los índices aceleran las búsquedas por columnas específicas.

-- Usuarios
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");

-- Sesiones
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- Accounts
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- Categorías
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE INDEX "categories_name_idx" ON "categories"("name");
CREATE INDEX "categories_deleted_at_idx" ON "categories"("deleted_at");

-- Proveedores
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");

-- Productos
CREATE INDEX "products_barcode_idx" ON "products"("barcode");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "products_supplier_id_idx" ON "products"("supplier_id");
CREATE INDEX "products_active_idx" ON "products"("active");

-- Servicios
CREATE INDEX "services_name_idx" ON "services"("name");
CREATE INDEX "services_is_active_idx" ON "services"("is_active");
CREATE INDEX "service_products_service_id_idx" ON "service_products"("service_id");
CREATE INDEX "service_products_product_id_idx" ON "service_products"("product_id");

-- Ventas
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");
CREATE INDEX "sales_user_id_idx" ON "sales"("user_id");
CREATE INDEX "sale_services_sale_id_idx" ON "sale_services"("sale_id");
CREATE INDEX "sale_services_service_id_idx" ON "sale_services"("service_id");
CREATE INDEX "sale_service_products_sale_service_id_idx" ON "sale_service_products"("sale_service_id");
CREATE INDEX "sale_service_products_product_id_idx" ON "sale_service_products"("product_id");
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- Inventario
CREATE INDEX "inventory_batches_movement_type_idx" ON "inventory_batches"("movement_type");
CREATE INDEX "inventory_batches_supplier_id_idx" ON "inventory_batches"("supplier_id");
CREATE INDEX "inventory_batches_created_at_idx" ON "inventory_batches"("created_at");
CREATE INDEX "inventory_batch_items_batch_id_idx" ON "inventory_batch_items"("batch_id");
CREATE INDEX "inventory_batch_items_product_id_idx" ON "inventory_batch_items"("product_id");
CREATE INDEX "inventory_movements_product_id_idx" ON "inventory_movements"("product_id");
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");
CREATE INDEX "inventory_movements_batch_id_idx" ON "inventory_movements"("batch_id");
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");

-- ─── Claves Foráneas ───

-- Sesiones → usuarios
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Accounts → usuarios
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Productos → categorías
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Productos → proveedores
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Productos de servicio → servicio
ALTER TABLE "service_products" ADD CONSTRAINT "service_products_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Productos de servicio → producto
ALTER TABLE "service_products" ADD CONSTRAINT "service_products_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ventas → usuario
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Servicios vendidos → venta
ALTER TABLE "sale_services" ADD CONSTRAINT "sale_services_sale_id_fkey"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Servicios vendidos → servicio
ALTER TABLE "sale_services" ADD CONSTRAINT "sale_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Productos de servicios vendidos → servicio vendido
ALTER TABLE "sale_service_products" ADD CONSTRAINT "sale_service_products_sale_service_id_fkey"
    FOREIGN KEY ("sale_service_id") REFERENCES "sale_services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Productos de servicios vendidos → producto
ALTER TABLE "sale_service_products" ADD CONSTRAINT "sale_service_products_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Items de venta → venta
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Items de venta → producto
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lotes → proveedor
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Lotes → usuario
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Items de lote → lote
ALTER TABLE "inventory_batch_items" ADD CONSTRAINT "inventory_batch_items_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Items de lote → producto
ALTER TABLE "inventory_batch_items" ADD CONSTRAINT "inventory_batch_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Movimientos → producto
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Movimientos → usuario
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Movimientos → lote
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

### Explicación del diseño de BD

**Enums de PostgreSQL**: `CREATE TYPE "ROLE" AS ENUM (...)`. Los enums son tipos de datos nativos de PostgreSQL. Más eficientes que guardar strings.

**`TIMESTAMPTZ`** vs `TIMESTAMP`: `TIMESTAMPTZ` (timestamp with time zone) guarda la hora en UTC y ajusta a la zona horaria del cliente al leer. Siempre preferí `TIMESTAMPTZ`.

**`UUID` como PK**: Usamos UUIDs en lugar de `SERIAL` (auto-incrementales). Ventajas:
- No exponen el número de registros (una URL `/users/3` revela que hay al menos 3 usuarios).
- Se pueden generar en el servidor (Rust) sin consultar la BD.
- Son únicos globalmente (útil para migraciones o sistemas distribuidos).

**`DECIMAL(10,2)`**: Para valores monetarios. Usar `FLOAT` para dinero puede causar errores de redondeo (0.1 + 0.2 = 0.30000000000000004).

**`deleted_at` (soft delete)**: En lugar de borrar registros permanentemente, los marcamos con `deleted_at`. Las queries siempre filtran `WHERE deleted_at IS NULL`. Ventajas:
- Se pueden recuperar datos borrados accidentalmente.
- Se mantiene la integridad referencial.

**Índices**: Cada columna que aparece en `WHERE`, `JOIN`, `ORDER BY` o que tiene una constraint `UNIQUE` debe tener índice. Los índices aceleran las búsquedas pero ralentizan las inserciones (hay que actualizar el índice).

**`ON DELETE RESTRICT`**: No permite borrar un registro si otros registros lo referencian. Más seguro que `CASCADE` (borra en cascada, podría borrar datos inadvertidamente).

**`ON DELETE SET NULL`**: Si se borra el registro referenciado, el campo se pone `NULL`. Útil para relaciones opcionales.

**`ON DELETE CASCADE`**: Si se borra el registro padre, los hijos también se borran. Útil para relaciones de composición (ej: items de una venta).

---

## 14. Feature `auth/domain` — Entidades y contratos

### `src/features/mod.rs`

```rust
pub mod auth;
```

Declara la feature `auth`.

### `src/features/auth/mod.rs`

```rust
pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod presentation;
```

Cada feature tiene las cuatro capas.

### `src/features/auth/domain/mod.rs`

```rust
pub mod contracts;
pub mod entities;
```

### `src/features/auth/domain/entities.rs`

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// Entidad de usuario (dominio).
/// Representa un usuario del sistema.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
    pub role: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Entidad de usuario con password.
/// Se usa internamente en el servicio, nunca se expone en respuestas HTTP.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserWithPassword {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
    pub role: Option<String>,
    pub password: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Entidad de verification (códigos de verificación).
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Verification {
    pub id: Uuid,
    pub identifier: String,
    pub value: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
```

### Explicación

**`#[derive(Debug, Serialize, Deserialize, FromRow)]`**:
- `Debug`: permite imprimir con `{:?}` para debugging.
- `Serialize`: convierte a JSON (para respuestas HTTP).
- `Deserialize`: convierte desde JSON (para requests HTTP, aunque no usemos User como request directo).
- `FromRow`: mapea automáticamente filas de SQLx a este struct.

**`Option<T>`**: Las columnas que pueden ser NULL en la BD se modelan como `Option<T>`. SQLx mapea `NULL → None` y `NOT NULL → Some(valor)`. Si defines un campo como `String` pero la BD puede devolver NULL, SQLx dará error.

**`UserWithPassword`**: Es una entidad separada de `User` porque:
- `User` no contiene password (se expone en respuestas).
- `UserWithPassword` contiene password (solo se usa internamente para login).

### `src/features/auth/domain/contracts/mod.rs`

```rust
pub mod account_repository;
pub mod session_repository;
pub mod user_repository;
pub mod verification_repository;
```

### `src/features/auth/domain/contracts/user_repository.rs`

```rust
use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    features::auth::domain::entities::User,
    shared::errors::app_error::AppError,
};

/// Contrato para el repositorio de usuarios.
/// Define las operaciones que la capa de aplicación puede realizar
/// sin conocer la implementación concreta (SQLx, mock, etc.).
#[async_trait]
pub trait UserRepository: Send + Sync + 'static {
    /// Busca un usuario por email.
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;

    /// Busca un usuario por ID.
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
}
```

### Explicación

**`#[async_trait]`**: Permite usar `async fn` dentro de un trait. Rust estable no soporta `async fn` en traits nativamente, así que esta macro transforma el trait para que devuelva `Pin<Box<dyn Future<...>>>`.

**`Send + Sync + 'static`**:
- `Send`: el objeto puede transferirse entre hilos (necesario para Tokio).
- `Sync`: se puede compartir referencia entre hilos.
- `'static`: el objeto no contiene referencias prestadas.

**`Result<Option<User>, AppError>`**: `Option` indica que el usuario puede existir o no. No confundir con "error": un email no encontrado NO es un error, es un `None` válido. Solo hay error si hay un problema con la BD.

### `src/features/auth/domain/contracts/session_repository.rs`

```rust
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    features::auth::infrastructure::models::session::Session,
    shared::errors::app_error::AppError,
};

/// Contrato para el repositorio de sesiones.
#[async_trait]
pub trait SessionRepository: Send + Sync + 'static {
    /// Busca una sesión por token (refresh token).
    async fn find_by_token(&self, token: &str) -> Result<Option<Session>, AppError>;

    /// Busca todas las sesiones de un usuario.
    async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Session>, AppError>;

    /// Elimina una sesión por token.
    async fn delete_by_token(&self, token: &str) -> Result<(), AppError>;

    /// Elimina una sesión por ID.
    async fn delete_by_id(&self, id: Uuid) -> Result<(), AppError>;

    /// Elimina todas las sesiones de un usuario (ej: al resetear password).
    async fn delete_by_user_id(&self, user_id: Uuid) -> Result<(), AppError>;

    /// Crea una nueva sesión.
    async fn create(
        &self,
        user_id: Uuid,
        token: &str,
        expires_at: DateTime<Utc>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AppError>;
}
```

Notar que `SessionRepository` devuelve `Session` (del módulo `infrastructure/models`, no de `domain/entities`). Esto es porque `Session` es más un registro de infraestructura (tiene `token`, `ip_address`, `user_agent`) que una entidad de dominio pura.

### `src/features/auth/domain/contracts/verification_repository.rs`

```rust
use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::{
    features::auth::domain::entities::Verification,
    shared::errors::app_error::AppError,
};

/// Contrato para el repositorio de códigos de verificación.
#[async_trait]
pub trait VerificationRepository: Send + Sync + 'static {
    /// Crea un nuevo código de verificación.
    async fn create(
        &self,
        identifier: &str,
        value: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AppError>;

    /// Busca un código por identifier + value.
    async fn find_by_identifier_and_value(
        &self,
        identifier: &str,
        value: &str,
    ) -> Result<Option<Verification>, AppError>;

    /// Elimina códigos de verificación por identifier.
    async fn delete_by_identifier(&self, identifier: &str) -> Result<(), AppError>;
}
```

### `src/features/auth/domain/contracts/account_repository.rs`

```rust
use async_trait::async_trait;

use crate::{
    features::auth::infrastructure::models::credentials_account::CredentialsAccount,
    shared::errors::app_error::AppError,
};

/// Contrato para el repositorio de cuentas (credenciales).
#[async_trait]
pub trait AccountRepository: Send + Sync + 'static {
    /// Busca credenciales por email (hace JOIN entre users y account).
    async fn find_credentials_by_email(
        &self,
        email: &str,
    ) -> Result<Option<CredentialsAccount>, AppError>;

    /// Actualiza la contraseña de un usuario por email.
    async fn update_password_by_email(
        &self,
        email: &str,
        hashed_password: &str,
    ) -> Result<(), AppError>;
}
```

---

## 15. Feature `auth/infrastructure` — Modelos y repositorios SQLx

### `src/features/auth/infrastructure/mod.rs`

```rust
pub mod mapper;
pub mod models;
pub mod sqlx;
```

### `src/features/auth/infrastructure/mapper.rs`

Este archivo está vacío en el proyecto original. Está preparado para futuros mapeadores entre entidades y DTOs.

### `src/features/auth/infrastructure/models/mod.rs`

```rust
pub mod credentials_account;
pub mod session;
```

### `src/features/auth/infrastructure/models/session.rs`

```rust
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// Fila de la tabla `session`.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
```

### `src/features/auth/infrastructure/models/credentials_account.rs`

```rust
use chrono::{DateTime, Utc};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// Resultado del JOIN entre users y account para login por credenciales.
/// NO es una entidad de dominio — es un modelo de infraestructura
/// que solo existe para mapear una query SQL específica.
#[derive(Debug, FromRow)]
pub struct CredentialsAccount {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
    pub role: Option<String>,
    pub password: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
```

**¿Por qué `CredentialsAccount` no implementa `Serialize`?** Porque contiene `password` y nunca debe exponerse en una respuesta HTTP.

### `src/features/auth/infrastructure/sqlx/mod.rs`

```rust
pub mod account_repository;
pub mod session_repository;
pub mod user_respository;
pub mod verification_repository;
```

### `src/features/auth/infrastructure/sqlx/user_respository.rs`

```rust
use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::auth::domain::{contracts::user_repository::UserRepository, entities::User},
    shared::errors::app_error::AppError,
};

/// Implementación concreta de UserRepository usando SQLx + PostgreSQL.
#[derive(Clone)]
pub struct SqlxUserRepository {
    pool: PgPool,
}

impl SqlxUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqlxUserRepository {
    /// Busca un usuario por email (excluye soft-deleted).
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT
                id,
                name,
                email,
                email_verified,
                image as "image?",
                role as "role?",
                created_at as "created_at?",
                updated_at as "updated_at?"
            FROM users
            WHERE email = $1 AND deleted_at IS NULL
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    /// Busca un usuario por ID (excluye soft-deleted).
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT
                id,
                name,
                email,
                email_verified,
                image as "image?",
                role as "role?",
                created_at as "created_at?",
                updated_at as "updated_at?"
            FROM users
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }
}

/// Operaciones que requieren transacción (fuera del trait).
impl SqlxUserRepository {
    /// Crea un nuevo usuario dentro de una transacción.
    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        name: &str,
        email: &str,
        role: &str,
    ) -> Result<User, AppError> {
        let user: User = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (
                id, name, email, email_verified, role, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                name,
                email,
                email_verified,
                image as "image?",
                role as "role?",
                created_at as "created_at?",
                updated_at as "updated_at?"
            "#,
            Uuid::new_v4(),
            name,
            email,
            false,          // email_verified inicialmente false
            role,
            Utc::now(),
            Utc::now(),
        )
        .fetch_one(tx.as_mut())  // 👈 usa la transacción, no el pool
        .await?;

        Ok(user)
    }
}
```

### Explicación de `sqlx::query_as!`

La macro `sqlx::query_as!`:
1. Se conecta a la BD en tiempo de compilación (usa `DATABASE_URL` del entorno).
2. Verifica que la tabla, columnas y tipos existan.
3. Verifica que los tipos SQL sean compatibles con los tipos Rust.
4. Si cambia la BD, el proyecto no compila hasta que actualices las queries.

**El `?` en `as "image?"`**: SQLx es estricto con NULLs. Cuando una columna puede ser NULL en la BD, hay que marcarla con `?` para que SQLx sepa que debe mapearla a `Option<T>`. Sin el `?`, si la BD devuelve NULL, SQLx lanza error.

**`tx.as_mut()`**: En lugar de usar `&self.pool` (una conexión del pool), usamos `tx.as_mut()` para ejecutar dentro de una transacción. Esto requiere que el método acepte `&mut Transaction<'_, Postgres>` y no `&self`.

### `src/features/auth/infrastructure/sqlx/session_repository.rs`

```rust
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    features::auth::{
        domain::contracts::session_repository::SessionRepository,
        infrastructure::models::session::Session,
    },
    shared::errors::app_error::AppError,
};

/// Implementación concreta de SessionRepository usando SQLx.
#[derive(Clone)]
pub struct SqlxSessionRepository {
    pool: PgPool,
}

impl SqlxSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SessionRepository for SqlxSessionRepository {
    async fn find_by_token(&self, token: &str) -> Result<Option<Session>, AppError> {
        let session = sqlx::query_as!(
            Session,
            r#"
            SELECT id, user_id, token, expires_at,
                   ip_address, user_agent,
                   created_at, updated_at
            FROM session
            WHERE token = $1
            "#,
            token
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(session)
    }

    async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Session>, AppError> {
        let sessions = sqlx::query_as!(
            Session,
            r#"
            SELECT id, user_id, token, expires_at,
                   ip_address, user_agent,
                   created_at, updated_at
            FROM session
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions)
    }

    async fn delete_by_token(&self, token: &str) -> Result<(), AppError> {
        sqlx::query!(r#"DELETE FROM session WHERE token = $1"#, token)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn delete_by_id(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query!(r#"DELETE FROM session WHERE id = $1"#, id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn delete_by_user_id(&self, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query!(r#"DELETE FROM session WHERE user_id = $1"#, user_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn create(
        &self,
        user_id: Uuid,
        token: &str,
        expires_at: DateTime<Utc>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO session (id, expires_at, token, user_id, ip_address, user_agent, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            Uuid::new_v4(),
            expires_at,
            token,
            user_id,
            ip_address,
            user_agent,
            Utc::now(),
            Utc::now(),
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
```

### `src/features/auth/infrastructure/sqlx/verification_repository.rs`

```rust
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::auth::{
        domain::{contracts::verification_repository::VerificationRepository, entities::Verification},
    },
    shared::errors::app_error::AppError,
};

/// Implementación concreta de VerificationRepository usando SQLx.
#[derive(Clone)]
pub struct SqlxVerificationRepository {
    pool: PgPool,
}

impl SqlxVerificationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl VerificationRepository for SqlxVerificationRepository {
    async fn create(
        &self,
        identifier: &str,
        value: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            Uuid::new_v4(),
            identifier,
            value,
            expires_at,
            Utc::now(),
            Utc::now(),
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn find_by_identifier_and_value(
        &self,
        identifier: &str,
        value: &str,
    ) -> Result<Option<Verification>, AppError> {
        let record = sqlx::query_as!(
            Verification,
            r#"
            SELECT id, identifier, value, expires_at, created_at, updated_at
            FROM verification
            WHERE identifier = $1 AND value = $2
            "#,
            identifier,
            value,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    async fn delete_by_identifier(&self, identifier: &str) -> Result<(), AppError> {
        sqlx::query!(r#"DELETE FROM verification WHERE identifier = $1"#, identifier)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}

/// Operaciones que requieren transacción (fuera del trait).
impl SqlxVerificationRepository {
    /// Crea un código de verificación dentro de una transacción.
    pub async fn create_tx(
        tx: &mut Transaction<'_, Postgres>,
        identifier: &str,
        value: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            Uuid::new_v4(),
            identifier,
            value,
            expires_at,
            Utc::now(),
            Utc::now(),
        )
        .execute(tx.as_mut())
        .await?;

        Ok(())
    }
}
```

### `src/features/auth/infrastructure/sqlx/account_repository.rs`

```rust
use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::auth::{
        domain::contracts::account_repository::AccountRepository,
        infrastructure::models::credentials_account::CredentialsAccount,
    },
    shared::errors::app_error::AppError,
};

/// Implementación concreta de AccountRepository usando SQLx.
#[derive(Clone)]
pub struct SqlxAccountRepository {
    pool: PgPool,
}

impl SqlxAccountRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AccountRepository for SqlxAccountRepository {
    /// Busca credenciales por email (JOIN users + account).
    /// Usa query_as sin macro porque el JOIN y las columnas son dinámicas.
    async fn find_credentials_by_email(
        &self,
        email: &str,
    ) -> Result<Option<CredentialsAccount>, AppError> {
        let result = sqlx::query_as::<_, CredentialsAccount>(
            r#"
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                u.email_verified,
                u.image,
                u.role::text as role,
                u.created_at,
                u.updated_at,
                a.password
            FROM users u
            JOIN account a ON a.user_id = u.id
            WHERE u.email = $1
              AND u.deleted_at IS NULL
              AND a.provider_id = 'credentials'
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    /// Actualiza la contraseña de un usuario por email.
    async fn update_password_by_email(
        &self,
        email: &str,
        hashed_password: &str,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE account
            SET password = $1, updated_at = $2
            WHERE provider_id = 'credentials'
              AND account_id = $3
            "#,
            hashed_password,
            Utc::now(),
            email,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

/// Operaciones que requieren transacción (fuera del trait).
impl SqlxAccountRepository {
    /// Crea una cuenta (credenciales) dentro de una transacción.
    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        email: &str,
        password: &str,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO account (
                id, account_id, provider_id, user_id, password, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
            Uuid::new_v4(),
            email,
            "credentials",
            user_id,
            password,
            Utc::now(),
            Utc::now(),
        )
        .execute(tx.as_mut())
        .await?;

        Ok(())
    }
}
```

### Explicación de `query_as::<Tipo, _>()` (sin macro)

En `find_credentials_by_email` usamos `sqlx::query_as::<_, CredentialsAccount>(...)` en lugar de `sqlx::query_as!(...)`:

```rust
let result = sqlx::query_as::<_, CredentialsAccount>(
    r#"SELECT u.id as user_id, u.name, ... FROM users u JOIN account a ..."#
)
.bind(email)
.fetch_optional(&self.pool)
.await?;
```

**¿Por qué no usar la macro `query_as!` aquí?** Porque la query tiene un JOIN y columnas con alias (`u.id as user_id`) y tipo casteado (`u.role::text as role`). La macro `query_as!` a veces tiene problemas con estos casos (depende de la versión de SQLx). `query_as` sin macro funciona igual pero sin chequeo en compilación del SQL (solo verifica tipos en tiempo de ejecución).

**`.bind(email)`**: Conecta el primer parámetro `$1` al valor. En `query_as!`, los parámetros van como argumentos de la macro. En `query_as` (sin macro), usamos `.bind()`.

---

## 16. Feature `auth/application` — Servicios de aplicación

### `src/features/auth/application/mod.rs`

```rust
pub mod authentication_service;
pub mod registration_service;
```

### `src/features/auth/application/registration_service.rs`

```rust
use chrono::Utc;

use crate::{
    features::auth::{
        domain::{
            contracts::{
                session_repository::SessionRepository,
                user_repository::UserRepository,
                verification_repository::VerificationRepository,
            },
            entities::User,
        },
        infrastructure::sqlx::{
            account_repository::SqlxAccountRepository,
            session_repository::SqlxSessionRepository,
            user_respository::SqlxUserRepository,
            verification_repository::SqlxVerificationRepository,
        },
        presentation::dto::{
            request::RegisterRequest,
            response::{MessageResponse, RegisterResponse, UserResponse},
        },
    },
    shared::{
        errors::app_error::AppError,
        security::{jwt, password::hash_password},
        state::app_state::AppState,
    },
};

/// Genera un código de verificación de 6 caracteres.
fn generate_verification_code() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    let hash = hasher.finish();

    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut code = String::with_capacity(6);
    let mut h = hash;
    for _ in 0..6 {
        code.push(CHARS[(h as usize) % CHARS.len()] as char);
        h /= CHARS.len() as u64;
    }
    code
}

/// Valida el rol y devuelve el string normalizado.
fn map_role(request_role: Option<String>) -> Result<&'static str, AppError> {
    match request_role.as_deref() {
        Some("admin") => Ok("admin"),
        Some("cajero") => Ok("cajero"),
        Some(other) => Err(AppError::BadRequest(format!(
            "Rol inválido '{}'. Solo se permite 'admin' o 'cajero'",
            other
        ))),
        None => Ok("cajero"), // Por defecto, cajero
    }
}

pub struct RegistrationService;

impl RegistrationService {
    /// Registra un nuevo usuario en el sistema.
    ///
    /// Flujo:
    /// 1. Verifica que el email no esté duplicado.
    /// 2. Hashea la contraseña.
    /// 3. Crea usuario + account + verification code en una transacción.
    /// 4. Genera tokens JWT.
    /// 5. Crea sesión con refresh token.
    pub async fn register_user(
        state: &AppState,
        payload: RegisterRequest,
    ) -> Result<RegisterResponse, AppError> {
        // ─── 1. Verificar email duplicado ───
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let existing = user_repo.find_by_email(&payload.email).await?;
        if existing.is_some() {
            return Err(AppError::Conflict("Email already registered".to_string()));
        }

        // ─── 2. Hashear password ───
        let hashed_password: String = hash_password(&payload.password)?;

        // ─── 3. Iniciar transacción ───
        let mut tx = state.db.begin().await?;

        // Validar y obtener rol
        let role = map_role(payload.role)?;

        // Crear usuario (dentro de la tx)
        let user: User = SqlxUserRepository::create(&mut tx, &payload.name, &payload.email, role)
            .await?;

        // Crear account (dentro de la tx)
        SqlxAccountRepository::create(&mut tx, &payload.email, &hashed_password, user.id).await?;

        // Generar código de verificación
        let verification_code = generate_verification_code();

        // Crear verification code (dentro de la tx)
        SqlxVerificationRepository::create_tx(
            &mut tx,
            &payload.email,
            &verification_code,
            Utc::now() + chrono::Duration::minutes(15),
        )
        .await?;

        tracing::info!("Código de verificación para {}: {}", payload.email, verification_code);

        // Confirmar transacción
        tx.commit().await?;

        // ─── 4. Generar tokens JWT ───
        let token_pair = jwt::generate_tokens(
            &user.id.to_string(),
            &user.email,
            user.role.as_deref().unwrap_or("cajero"),
        )?;

        // ─── 5. Crear sesión (fuera de la tx) ───
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None, // IP (se puede pasar desde el handler)
                None, // User-Agent (se puede pasar desde el handler)
            )
            .await?;

        // ─── 6. Armar respuesta ───
        Ok(RegisterResponse {
            message: "User created successfully. Please verify your email.".to_string(),
            user: UserResponse::from(user),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Reenviar código de verificación ───

    /// Reenvía el código de verificación para un email.
    public async fn resend_verification(
        state: &AppState,
        email: &str,
    ) -> Result<MessageResponse, AppError> {
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());

        let user = user_repo.find_by_email(email).await?;

        match user {
            Some(user) if user.email_verified => {
                return Err(AppError::Conflict("Email already verified".to_string()));
            }
            Some(_) => {
                // Eliminar código anterior y crear nuevo
                verification_repo.delete_by_identifier(email).await?;

                let code = generate_verification_code();
                let expires_at = Utc::now() + chrono::Duration::minutes(15);

                verification_repo.create(email, &code, expires_at).await?;

                tracing::info!("Nuevo código de verificación para {}: {}", email, code);

                Ok(MessageResponse {
                    message: "New verification code sent".to_string(),
                })
            }
            None => {
                // Mismo mensaje para anti-email-enumeration
                Ok(MessageResponse {
                    message: "If the email exists, a new verification code has been sent"
                        .to_string(),
                })
            }
        }
    }
}
```

### Explicación bloque por bloque

**Transacciones**: La operación de registro involucra 3 tablas (users, account, verification). Si falla la segunda inserción, la primera debe revertirse. Por eso usamos una transacción:

1. `let mut tx = state.db.begin().await?;` — inicia la transacción.
2. Las operaciones reciben `&mut tx` en lugar de `&self.pool`.
3. `tx.commit().await?;` — confirma todo si no hubo errores.
4. Si hay un `?` antes del commit, `tx` sale de scope y SQLx automáticamente hace rollback.

**¿Por qué la sesión se crea fuera de la transacción?** Porque la sesión no es parte del registro atómico. Si falla la creación de sesión, el usuario ya está registrado y puede reintentar el login.

**`generate_verification_code()`**: Función local que genera un código de 6 caracteres alfanuméricos. Usa el timestamp actual como semilla para un hash. No es criptográficamente segura, pero suficiente para códigos de verificación de corta duración.

**`map_role()`**: Valida que el rol sea 'admin' o 'cajero'. Si no se especifica, por defecto 'cajero'. Si se especifica algo inválido, devuelve `AppError::BadRequest`.

### `src/features/auth/application/authentication_service.rs`

```rust
use chrono::Utc;

use crate::{
    features::auth::{
        domain::contracts::{
            account_repository::AccountRepository,
            session_repository::SessionRepository,
            user_repository::UserRepository,
            verification_repository::VerificationRepository,
        },
        infrastructure::sqlx::{
            account_repository::SqlxAccountRepository,
            session_repository::SqlxSessionRepository,
            user_respository::SqlxUserRepository,
            verification_repository::SqlxVerificationRepository,
        },
        presentation::dto::{
            MessageResponse, RegisterResponse, SessionListResponse, SessionResponse, UserResponse,
        },
    },
    shared::{
        errors::app_error::AppError,
        helpers::generate::generate_code,
        security::{
            jwt,
            password::{hash_password, verify_password},
        },
        state::app_state::AppState,
    },
};

pub struct AuthenticationService;

impl AuthenticationService {
    // ─── Login ───

    /// Autentica un usuario con email y password.
    ///
    /// Flujo:
    /// 1. Busca credenciales por email (JOIN users + account).
    /// 2. Verifica la contraseña con bcrypt.
    /// 3. Genera tokens JWT.
    /// 4. Crea una sesión con el refresh token.
    pub async fn login(
        state: &AppState,
        email: &str,
        password: &str,
    ) -> Result<RegisterResponse, AppError> {
        // 1. Buscar usuario + credenciales
        let account_repo = SqlxAccountRepository::new(state.db.clone());
        let account = account_repo
            .find_credentials_by_email(email)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

        // 2. Verificar que tenga password (no es OAuth)
        let hashed_password = account
            .password
            .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

        // 3. Verificar password con bcrypt
        let valid = verify_password(password, &hashed_password)?;
        if !valid {
            return Err(AppError::Unauthorized("Invalid credentials".to_string()));
        }

        // 4. Generar tokens JWT
        let token_pair = jwt::generate_tokens(
            &account.user_id.to_string(),
            &account.email,
            account.role.as_deref().unwrap_or("cajero"),
        )?;

        // 5. Crear sesión con refresh token
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        session_repo
            .create(
                account.user_id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 6. Armar response
        let user_response = UserResponse {
            id: account.user_id,
            name: account.name,
            email: account.email,
            email_verified: account.email_verified,
            role: account.role,
            image: account.image,
            created_at: account.created_at,
            updated_at: account.updated_at,
        };

        Ok(RegisterResponse {
            message: "Login successful".to_string(),
            user: user_response,
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Refresh Token ───

    /// Refresca los tokens usando un refresh token válido.
    ///
    /// Implementa **token rotation**: invalida el refresh token anterior
    /// y crea uno nuevo. Esto limita la ventana de robo de tokens.
    pub async fn refresh(
        state: &AppState,
        refresh_token: &str,
    ) -> Result<RegisterResponse, AppError> {
        // 1. Verificar JWT del refresh token
        let claims = jwt::verify_refresh_token(refresh_token)?;
        let user_id = uuid::Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

        let user_repo = SqlxUserRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 2. Buscar sesión por token
        let session = session_repo
            .find_by_token(refresh_token)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;

        // 3. Verificar que la sesión no haya expirado
        if session.expires_at < Utc::now() {
            tracing::warn!("[refresh] Sesión expirada, eliminando");
            session_repo.delete_by_token(refresh_token).await?;
            return Err(AppError::Unauthorized("Session expired".to_string()));
        }

        // 4. Buscar usuario (con deleted_at IS NULL)
        let user = user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

        // 5. Eliminar sesión anterior (token rotation)
        session_repo.delete_by_token(refresh_token).await?;

        // 6. Generar nuevos tokens
        let token_pair = jwt::generate_tokens(
            &user.id.to_string(),
            &user.email,
            user.role.as_deref().unwrap_or("cajero"),
        )?;

        // 7. Crear nueva sesión
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 8. Armar response
        Ok(RegisterResponse {
            message: "Token refreshed successfully".to_string(),
            user: UserResponse::from(user),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Logout ───

    /// Cierra la sesión del usuario eliminando el refresh token de la BD.
    pub async fn logout(
        state: &AppState,
        refresh_token: &str,
    ) -> Result<MessageResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        session_repo.delete_by_token(refresh_token).await?;

        Ok(MessageResponse {
            message: "Logged out successfully".to_string(),
        })
    }

    // ─── Verify Email ───

    /// Verifica el email de un usuario con un código de verificación.
    pub async fn verify_email(
        state: &AppState,
        identifier: &str,
        code: &str,
    ) -> Result<RegisterResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 1. Buscar verification code
        let verification = verification_repo
            .find_by_identifier_and_value(identifier, code)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid verification code".to_string()))?;

        // 2. Verificar expiración
        if verification.expires_at < Utc::now() {
            verification_repo.delete_by_identifier(identifier).await?;
            return Err(AppError::Unauthorized("Verification code expired".to_string()));
        }

        // 3. Buscar usuario
        let user = user_repo
            .find_by_email(identifier)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // 4. Actualizar email_verified en la BD
        //    Usamos query directo porque es una operación simple
        sqlx::query!(
            "UPDATE users SET email_verified = true, updated_at = $1 WHERE id = $2",
            Utc::now(),
            user.id,
        )
        .execute(&state.db)
        .await?;

        // 5. Eliminar verification code (ya no sirve)
        verification_repo.delete_by_identifier(identifier).await?;

        // 6. Generar nuevos tokens
        let token_pair = jwt::generate_tokens(
            &user.id.to_string(),
            &user.email,
            user.role.as_deref().unwrap_or("cajero"),
        )?;

        // 7. Crear nueva sesión
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 8. Armar response
        Ok(RegisterResponse {
            message: "Email verified successfully".to_string(),
            user: UserResponse::from(user),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Forgot Password ───

    /// Inicia el proceso de recuperación de contraseña.
    /// Genera un código de verificación y lo asocia al email.
    ///
    /// NOTA: No revela si el email existe o no (anti-enumeration).
    pub async fn forgot_password(
        state: &AppState,
        email: &str,
    ) -> Result<MessageResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());

        // Verificar si el usuario existe (pero mismo mensaje para anti-enumeration)
        let _user_exists = user_repo.find_by_email(email).await?.is_some();

        // El mensaje es el mismo exista o no
        if _user_exists {
            // Generar reset code
            let reset_code = generate_code();
            let expires_at = Utc::now() + chrono::Duration::minutes(15);

            // Eliminar códigos previos y crear nuevo
            verification_repo
                .delete_by_identifier(&format!("reset:{email}"))
                .await?;
            verification_repo
                .create(&format!("reset:{email}"), &reset_code, expires_at)
                .await?;

            tracing::info!("Reset code for {}: {}", email, reset_code);
        }

        Ok(MessageResponse {
            message: "If the email exists, a reset code has been sent".to_string(),
        })
    }

    // ─── Reset Password ───

    /// Completa el proceso de recuperación de contraseña.
    /// Verifica el código, actualiza la contraseña y elimina todas las sesiones.
    pub async fn reset_password(
        state: &AppState,
        email: &str,
        code: &str,
        new_password: &str,
    ) -> Result<MessageResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let account_repo = SqlxAccountRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 1. Buscar verification code con prefix reset:
        let identifier = format!("reset:{email}");
        let verification = verification_repo
            .find_by_identifier_and_value(&identifier, code)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid reset code".to_string()))?;

        // 2. Verificar expiración
        if verification.expires_at < Utc::now() {
            verification_repo.delete_by_identifier(&identifier).await?;
            return Err(AppError::Unauthorized("Reset code expired".to_string()));
        }

        // 3. Buscar usuario
        let user = user_repo
            .find_by_email(email)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // 4. Hashear nueva password
        let hashed = hash_password(new_password)?;

        // 5. Actualizar password en account
        account_repo
            .update_password_by_email(email, &hashed)
            .await?;

        // 6. Eliminar TODAS las sesiones del usuario (fuerza re-login)
        session_repo.delete_by_user_id(user.id).await?;

        // 7. Eliminar verification code
        verification_repo.delete_by_identifier(&identifier).await?;

        Ok(MessageResponse {
            message: "Password reset successfully. Please login with your new password."
                .to_string(),
        })
    }

    // ─── List Sessions ───

    /// Obtiene todas las sesiones activas de un usuario.
    pub async fn get_user_sessions(
        state: &AppState,
        user_id: uuid::Uuid,
    ) -> Result<SessionListResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        let sessions = session_repo
            .find_by_user_id(user_id)
            .await?
            .into_iter()
            .map(SessionResponse::from_session)
            .collect();

        Ok(SessionListResponse { sessions })
    }

    // ─── Revoke Session ───

    /// Revoca (elimina) una sesión específica de un usuario.
    /// Verifica que la sesión pertenezca al usuario antes de eliminarla.
    pub async fn revoke_session(
        state: &AppState,
        user_id: uuid::Uuid,
        session_id: uuid::Uuid,
    ) -> Result<MessageResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // Buscar todas las sesiones del usuario y verificar que la session_id le pertenece
        let sessions = session_repo.find_by_user_id(user_id).await?;
        let found = sessions.iter().any(|s| s.id == session_id);

        if !found {
            return Err(AppError::NotFound("Session not found".to_string()));
        }

        session_repo.delete_by_id(session_id).await?;

        Ok(MessageResponse {
            message: "Session revoked successfully".to_string(),
        })
    }
}
```

### Explicación de los patrones de seguridad

**Anti-email-enumeration** (en `forgot_password`):
```rust
let _user_exists = user_repo.find_by_email(email).await?.is_some();

if _user_exists {
    // generar código...
}

// Mismo mensaje independientemente
Ok(MessageResponse {
    message: "If the email exists, a reset code has been sent".to_string(),
})
```

El mensaje de respuesta es **el mismo** exista o no el email. Esto evita que un atacante pueda determinar qué emails están registrados.

**Token rotation** (en `refresh`):
```rust
// Eliminar sesión anterior
session_repo.delete_by_token(refresh_token).await?;

// Generar nuevos tokens
let token_pair = jwt::generate_tokens(...)?;

// Crear nueva sesión
session_repo.create(user.id, &token_pair.refresh_token, ...).await?;
```

Cada vez que se refresca un token, el anterior se invalida. Si un atacante roba un refresh token y lo usa, el token original deja de funcionar. El usuario legítimo recibe un error al intentar refrescar, lo que le alerta del robo.

---

## 17. Feature `auth/presentation` — DTOs, handlers y rutas

### `src/features/auth/presentation/mod.rs`

```rust
pub mod dto;
pub mod handlers;
pub mod routes;
```

### `src/features/auth/presentation/dto/mod.rs`

```rust
pub mod request;
pub mod response;
```

### `src/features/auth/presentation/dto/request.rs`

```rust
use serde::Deserialize;
use validator::Validate;
use uuid::Uuid;

// ─── Login ───

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

// ─── Refresh ───

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
}

// ─── Register ───

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: String,

    #[validate(email(message = "Invalid email format"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,

    pub role: Option<String>,
}

// ─── Verify Email ───

#[derive(Debug, Deserialize, Validate)]
pub struct VerifyEmailRequest {
    #[validate(email(message = "Invalid email format"))]
    pub identifier: String,

    #[validate(length(min = 6, message = "Code must be at least 6 characters"))]
    pub code: String,
}

// ─── Resend Verification ───

#[derive(Debug, Deserialize, Validate)]
pub struct ResendVerificationRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

// ─── Forgot Password ───

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

// ─── Reset Password ───

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,

    #[validate(length(min = 6, message = "Code must be at least 6 characters"))]
    pub code: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub new_password: String,
}

// ─── Revoke Session ───

#[derive(Debug, Deserialize)]
pub struct RevokeSessionParams {
    pub session_id: Uuid,
}
```

### Explicación

**`#[derive(Validate)]`**: Habilita las validaciones declarativas. Cada campo puede tener uno o más validadores.

**`#[serde(rename = "refreshToken")]`**: El campo `refresh_token` en Rust (snake_case) se mapea desde `refreshToken` en JSON (camelCase). Sin esto, el cliente tendría que enviar `refresh_token` en lugar de `refreshToken`.

**`Option<String>` en `RefreshRequest`**: El refresh token puede venir en el body o en una cookie. Si viene en cookie, el body puede estar vacío.

### `src/features/auth/presentation/dto/response.rs`

```rust
use serde::Serialize;
use uuid::Uuid;

use crate::features::auth::{
    domain::entities::User,
    infrastructure::models::session::Session,
};

// ─── Register / Login Response ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterResponse {
    pub message: String,
    pub user: UserResponse,
    pub access_token: String,
    pub refresh_token: String,
}

// ─── User Response ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub role: Option<String>,
    pub image: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

// ─── Session Response ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub id: Uuid,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
}

impl SessionResponse {
    pub fn from_session(session: Session) -> Self {
        Self {
            id: session.id,
            expires_at: session.expires_at,
            ip_address: session.ip_address,
            user_agent: session.user_agent,
            created_at: session.created_at,
            updated_at: session.updated_at,
            is_active: Some(session.expires_at > chrono::Utc::now()),
        }
    }
}

// ─── Session List Response ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionListResponse {
    pub sessions: Vec<SessionResponse>,
}

// ─── Message Response (para operaciones sin data compleja) ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

// ─── Conversiones ───

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            email_verified: user.email_verified,
            role: user.role,
            image: user.image,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}
```

### Explicación

**`#[serde(rename_all = "camelCase")]`**: Transforma automáticamente `snake_case` de Rust a `camelCase` de JavaScript. Ejemplo: `email_verified` → `emailVerified`, `access_token` → `accessToken`.

**`#[serde(skip_serializing_if = "Option::is_none")]`**: Si `is_active` es `None`, no se incluye en el JSON. Útil para respuestas donde algunos campos son opcionales.

**`SessionResponse::from_session(session)`**: Convierte un modelo de infraestructura (`Session`) a un DTO de respuesta. Calcula `is_active` comparando `expires_at` con la hora actual.

**`impl From<User> for UserResponse`**: Permite convertir un `User` en `UserResponse` con `UserResponse::from(user)` o simplemente `user.into()`.

### `src/features/auth/presentation/handlers/mod.rs`

```rust
pub mod forgot_password_handler;
pub mod login_handler;
pub mod logout_handler;
pub mod refresh_handler;
pub mod registration_handler;
pub mod resend_verification_handler;
pub mod reset_password_handler;
pub mod session_handler;
pub mod verify_email_handler;
```

### `src/features/auth/presentation/handlers/registration_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::registration_service::RegistrationService,
        presentation::dto::{
            request::RegisterRequest, response::RegisterResponse,
        },
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

/// POST /api/v1/auth/register
/// Crea un nuevo usuario. Requiere rol admin.
pub async fn register_user(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), AppError> {
    // Validar datos de entrada
    payload.validate()?;

    let response: RegisterResponse = RegistrationService::register_user(&state, payload).await?;

    Ok((StatusCode::CREATED, Json(response)))
}
```

### `src/features/auth/presentation/handlers/login_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::LoginRequest, response::RegisterResponse},
    },
    shared::{
        errors::app_error::AppError, security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

/// POST /api/v1/auth/login
/// Autentica un usuario y devuelve tokens + cookies.
pub async fn login_user(
    State(state): State<AppState>,
    jar: CookieJar,                                                          // ← cookies de la request
    Json(payload): Json<LoginRequest>,
) -> Result<(StatusCode, CookieJar, Json<RegisterResponse>), AppError> {
    payload.validate()?;

    let response: RegisterResponse =
        AuthenticationService::login(&state, &payload.email, &payload.password).await?;

    // Establecer cookies httpOnly con los tokens
    let jar: CookieJar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((StatusCode::OK, jar, Json(response)))
}
```

### `src/features/auth/presentation/handlers/logout_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::MessageResponse,
    },
    shared::{
        errors::app_error::AppError,
        security::cookies::clear_auth_cookies,
        state::app_state::AppState,
    },
};

/// POST /api/v1/auth/logout
/// Cierra la sesión y elimina las cookies de autenticación.
pub async fn logout_user(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(StatusCode, CookieJar, Json<MessageResponse>), AppError> {
    // Leer refresh token de cookie
    let refresh_token = jar
        .get("refreshToken")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::BadRequest("Refresh token required".to_string()))?;

    let response = AuthenticationService::logout(&state, &refresh_token).await?;

    // Eliminar cookies (max_age = 0)
    let jar = clear_auth_cookies(jar);

    Ok((StatusCode::OK, jar, Json(response)))
}
```

### `src/features/auth/presentation/handlers/refresh_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::RefreshRequest, response::RegisterResponse},
    },
    shared::{
        errors::app_error::AppError, security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

/// POST /api/v1/auth/refresh
/// Refresca los tokens usando el refresh token (cookie o body).
pub async fn refresh_token(
    State(state): State<AppState>,
    jar: CookieJar,
    payload: Option<Json<RefreshRequest>>,  // ← puede ser None si viene en cookie
) -> Result<(StatusCode, CookieJar, Json<RegisterResponse>), AppError> {
    // Primero intentar desde cookie httpOnly, luego body como fallback
    let refresh_token: String = jar
        .get("refreshToken")
        .map(|c| c.value().to_string())
        .or_else(|| {
            payload.and_then(|p| p.refresh_token.clone())
        })
        .ok_or_else(|| AppError::BadRequest("Refresh token required".to_string()))?;

    let response: RegisterResponse = AuthenticationService::refresh(&state, &refresh_token).await?;

    let jar: CookieJar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((StatusCode::OK, jar, Json(response)))
}
```

### `src/features/auth/presentation/handlers/verify_email_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::VerifyEmailRequest, response::MessageResponse},
    },
    shared::{
        errors::app_error::AppError,
        security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

/// POST /api/v1/auth/verify-email
/// Verifica el email con el código de verificación.
pub async fn verify_email(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<(StatusCode, CookieJar, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::verify_email(&state, &payload.identifier, &payload.code).await?;

    // Los tokens van SOLO en cookies, no en el body
    let jar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((
        StatusCode::OK,
        jar,
        Json(MessageResponse {
            message: "Email verified successfully".to_string(),
        }),
    ))
}
```

### `src/features/auth/presentation/handlers/forgot_password_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::ForgotPasswordRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

/// POST /api/v1/auth/forgot-password
/// Inicia el proceso de recuperación de contraseña.
pub async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::forgot_password(&state, &payload.email).await?;

    Ok((StatusCode::OK, Json(response)))
}
```

### `src/features/auth/presentation/handlers/reset_password_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::ResetPasswordRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

/// POST /api/v1/auth/reset-password
/// Completa el proceso de recuperación de contraseña.
pub async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::reset_password(
        &state,
        &payload.email,
        &payload.code,
        &payload.new_password,
    )
    .await?;

    Ok((StatusCode::OK, Json(response)))
}
```

### `src/features/auth/presentation/handlers/session_handler.rs`

```rust
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    Extension,
};
use uuid::Uuid;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::response::{MessageResponse, SessionListResponse},
    },
    shared::{
        errors::app_error::AppError,
        security::jwt::AccessTokenClaims,
        state::app_state::AppState,
    },
};

/// GET /api/v1/auth/sessions
/// Obtiene todas las sesiones del usuario autenticado.
pub async fn get_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<AccessTokenClaims>,  // ← del middleware
) -> Result<(StatusCode, Json<SessionListResponse>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

    let response = AuthenticationService::get_user_sessions(&state, user_id).await?;

    Ok((StatusCode::OK, Json(response)))
}

/// DELETE /api/v1/auth/sessions/{session_id}
/// Revoca (elimina) una sesión específica.
pub async fn revoke_session(
    State(state): State<AppState>,
    Extension(claims): Extension<AccessTokenClaims>,
    Path(session_id): Path<Uuid>,  // ← de la URL: /sessions/{session_id}
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

    let response = AuthenticationService::revoke_session(&state, user_id, session_id).await?;

    Ok((StatusCode::OK, Json(response)))
}
```

### `src/features/auth/presentation/handlers/resend_verification_handler.rs`

```rust
use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::registration_service::RegistrationService,
        presentation::dto::{request::ResendVerificationRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

/// POST /api/v1/auth/resend-verification
/// Reenvía el código de verificación de email.
pub async fn resend_verification(
    State(state): State<AppState>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = RegistrationService::resend_verification(&state, &payload.email).await?;

    Ok((StatusCode::OK, Json(response)))
}
```

### `src/features/auth/presentation/routes.rs`

```rust
use axum::{
    Router, middleware,
    routing::{delete, get, post},
};

use crate::{
    features::auth::presentation::handlers::{
        forgot_password_handler, login_handler, logout_handler, refresh_handler,
        registration_handler, resend_verification_handler, reset_password_handler, session_handler,
        verify_email_handler,
    },
    shared::{security::auth_guard, state::app_state::AppState},
};

/// Define las rutas de autenticación.
///
 /// Organización:
/// - Rutas públicas: login, refresh, logout, verify-email, forgot/reset password
/// - Rutas de admin: register (solo admin)
/// - Rutas de usuario autenticado: sessions (cualquier rol)
pub fn routes() -> Router<AppState> {
    // Rutas accesibles sin autenticación
    let public_routes = Router::new()
        .route("/login", post(login_handler::login_user))
        .route("/refresh", post(refresh_handler::refresh_token))
        .route("/logout", post(logout_handler::logout_user))
        .route("/verify-email", post(verify_email_handler::verify_email))
        .route(
            "/resend-verification",
            post(resend_verification_handler::resend_verification),
        )
        .route(
            "/forgot-password",
            post(forgot_password_handler::forgot_password),
        )
        .route(
            "/reset-password",
            post(reset_password_handler::reset_password),
        );

    // Rutas solo para admin
    let admin_routes = Router::new()
        .route("/register", post(registration_handler::register_user))
        .route_layer(middleware::from_fn(auth_guard::admin_middleware));

    // Rutas para usuario autenticado (cualquier rol)
    let user_routes = Router::new()
        .route("/sessions", get(session_handler::get_sessions))
        .route(
            "/sessions/{session_id}",                           // ← Axum 0.8 usa {param}
            delete(session_handler::revoke_session),
        )
        .route_layer(middleware::from_fn(auth_guard::require_auth_middleware));

    // Combinar todo (el orden no importa porque son disjuntas)
    public_routes.merge(admin_routes).merge(user_routes)
}
```

### Explicación

**`Router::new()`**: Crea un router vacío.

**`.route("/login", post(login_handler::login_user))`**: Asocia el método POST a la ruta `/login` con el handler `login_user`. Notar que la ruta es relativa — cuando se monte en el router raíz con `.nest("/api/v1/auth", routes)`, la ruta completa será `/api/v1/auth/login`.

**`middleware::from_fn(auth_guard::admin_middleware)`**: Convierte nuestra función de middleware en un layer de Tower. `.route_layer(...)` aplica el middleware solo a las rutas de ese router específico.

**`.merge(admin_routes)`**: Combina las rutas de admin con las públicas. Si hubiera conflictos de ruta, el merge fallaría en compilación.

---

## 18. Router raíz `routes/mod.rs`

### `src/routes/mod.rs`

```rust
use axum::Router;

use crate::{features, shared::state::app_state::AppState};

/// Crea el router raíz de la aplicación.
/// Monta todas las features bajo sus prefijos correspondientes.
pub fn create_routes() -> Router<AppState> {
    Router::new().nest(
        "/api/v1/auth",                                    // prefijo
        features::auth::presentation::routes::routes(),    // sub-router de auth
    )
    // En el futuro:
    // .nest("/api/v1/products", features::products::presentation::routes::routes())
    // .nest("/api/v1/sales", features::sales::presentation::routes::routes())
}
```

**`.nest("/api/v1/auth", routes)`**: Monta todas las rutas de `auth` bajo el prefijo `/api/v1/auth`. Así, una ruta `/login` en el sub-router se convierte en `/api/v1/auth/login` a nivel global.

---

## 19. Cómo ejecutar el proyecto

### Paso 1: Crear la base de datos

```bash
# Con psql
createdb mi_negocio

# O desde psql
psql -U postgres -c "CREATE DATABASE mi_negocio;"
```

### Paso 2: Configurar variables de entorno

Creá el archivo `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mi_negocio
FRONTEND_URL=http://localhost:3000
JWT_SECRET=mi-clave-secreta-super-segura
JWT_REFRESH_SECRET=mi-clave-refresh-super-segura
NODE_ENV=development
```

### Paso 3: Ejecutar las migraciones

```bash
# Opción 1: Directamente con psql
psql -U postgres -d mi_negocio -f src/database/migrations/20260629234600_full_schema.sql

# Opción 2: Con la CLI de sqlx
cargo install sqlx-cli
sqlx migrate run
```

### Paso 4: Compilar y ejecutar

```bash
# Compilar (la primera vez toma varios minutos)
cargo build

# Ejecutar
cargo run --bin server
```

Deberías ver:
```
INFO Conectando a la base de datos...
INFO Servidor escuchando en http://0.0.0.0:4001
```

### Paso 5: Probar los endpoints

```bash
# Registrar un usuario
curl -X POST http://localhost:4001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin1234"}'

# Ver el código de verificación en los logs del servidor
# (en producción enviarías un email)
```

---

## 20. Buenas prácticas y errores comunes

### Buenas prácticas

1. **Fast Fail**: Si la BD no está disponible al iniciar, que el servidor no arranque (`expect` en `create_pool`). Es mejor que el orquestador reinicie a tener un servidor que funciona pero siempre devuelve 500.

2. **Anti-email-enumeration**: Siempre devolvé el mismo mensaje independientemente de si un email existe o no (ver `forgot_password`).

3. **Token rotation**: Cada refresh invalida el token anterior. Si un atacante roba un refresh token, al usarlo deja inválido el original.

4. **httpOnly cookies**: Los tokens JWT nunca son accesibles desde JavaScript. Esto previene ataques XSS.

5. **bcrypt para passwords**: Costo 10 como mínimo. SHA/MD5/texto plano NUNCA.

6. **Transacciones**: Cualquier operación que afecte múltiples tablas debe ser atómica (commit o rollback).

7. **Soft delete**: Marcar registros como eliminados (`deleted_at`) en lugar de borrarlos. Permite recuperación y mantiene integridad referencial.

8. **UUID como PK**: No exponen información (a diferencia de IDs auto-incrementales) y se pueden generar del lado del servidor.

9. **Separación en capas**: Domain (entidades + traits) → Application (servicios) → Infrastructure (SQLx) → Presentation (HTTP). Cada capa solo depende de las inferiores.

10. **Logging estructurado**: Usá `tracing::info!`, `tracing::warn!`, etc. Nunca `println!`. En producción, configurá formato JSON.

11. **Errores consistentes**: Todas las respuestas de error tienen el mismo formato JSON `{"error": "...", "message": "..."}`.

12. **Validación en la capa de presentación**: Los DTOs de request validan los datos de entrada con `validator`. La capa de aplicación recibe datos ya validados.

### Errores comunes

1. **Olvidar `#[derive(Clone)]` en `AppState`**: Axum necesita clonar el estado. Sin Clone, no compila.

2. **No tener `DATABASE_URL` al compilar**: Las macros `query!` y `query_as!` necesitan la BD en tiempo de compilación para verificar las queries.

3. **No marcar columnas NULL con `?` en `query_as!`**: Si la columna puede ser NULL en la BD, usá `as "campo?"`. Sin el `?`, la compilación falla.

4. **Usar `Float` para dinero**: Los floats tienen errores de redondeo. Usá `DECIMAL(10,2)` en la BD y tipos enteros en Rust (centavos).

5. **Orden incorrecto de layers**: El último layer agregado es el primero en ejecutarse para requests. Poné CORS antes de Trace.

6. **No usar `?` en handlers que devuelven `Result<..., AppError>`**: Si la función devuelve un error, usá `?` para que se convierta automáticamente a `AppError` via `From`.

7. **Transacciones muy largas**: Mantené las transacciones cortas. No hagas operaciones lentas (envío de email, etc.) dentro de una transacción.

8. **Confundir `axum::serve` con la API vieja**: En Axum 0.8, usá `let listener = TcpListener::bind(...).await?; axum::serve(listener, router).await?;`.

9. **Olvidar `tower::ServiceExt` en tests**: Para usar `.oneshot()` en tests necesitás `use tower::ServiceExt;`.

10. **Exponer información sensible en errores**: No incluyas el email en mensajes de error de login. Siempre "Invalid credentials".

---
