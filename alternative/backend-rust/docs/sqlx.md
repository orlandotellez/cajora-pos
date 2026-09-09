# Manual de SQLx con Rust (Migraciones y uso básico)

## Índice

1. [Instalar SQLx CLI](#instalar-sqlx-cli)
2. [Si sigue sin funcionar](#si-sigue-sin-funcionar)
3. [¿Qué es SQLx?](#qué-es-sqlx)
4. [Instalación](#instalación)
5. [Crear proyecto Rust](#crear-proyecto-rust)
6. [Dependencias en Cargo.toml](#dependencias-en-cargotoml)
7. [Variables de entorno](#variables-de-entorno)
8. [Crear migraciones](#crear-migraciones)
9. [Escribir migración](#escribir-migración)
10. [Ejecutar migraciones](#ejecutar-migraciones)
11. [Revertir migración](#revertir-migración)
12. [Conexión a la base de datos](#conexión-a-la-base-de-datos)
13. [Usar migraciones desde Rust](#usar-migraciones-desde-rust)
14. [Insertar datos](#insertar-datos)
15. [Obtener datos](#obtener-datos)
16. [Usar structs](#usar-structs)
17. [Verificación de queries en compilación](#verificación-de-queries-en-compilación)
18. [Comandos importantes de SQLx CLI](#comandos-importantes-de-sqlx-cli)
19. [Estructura típica del proyecto](#estructura-típica-del-proyecto)
20. [Buenas prácticas](#buenas-prácticas)

---

# 1. Instalar SQLx CLI

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

Esto instalará el binario `sqlx` en:

```
~/.cargo/bin/sqlx
```

Verifica:

```bash
sqlx --version
```

---

# 2. Si sigue sin funcionar

Asegúrate de que **Cargo esté en tu PATH**.

Comprueba:

```bash
echo $PATH
```

Debe incluir:

```
$HOME/.cargo/bin
```

Si no está, añade esto a `~/.bashrc` o `~/.zshrc`:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

Luego recarga:

```bash
source ~/.bashrc
```

o

```bash
source ~/.zshrc
```

---

## 1. ¿Qué es SQLx?

SQLx es un **cliente SQL asíncrono para Rust** que permite interactuar con bases de datos **sin ORM**, usando **consultas SQL reales** con verificación en tiempo de compilación.

Bases soportadas:

* PostgreSQL
* MySQL
* SQLite
* MSSQL (limitado)

Características principales:

* Async (usa Tokio o async-std)
* Verificación de queries en compilación
* Migraciones integradas
* Sin ORM pesado

---

# 2. Instalación

## Instalar CLI de SQLx

Necesitas el CLI para migraciones.

```bash
cargo install sqlx-cli
```

Con soporte para tu base de datos:

### PostgreSQL

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

### MySQL

```bash
cargo install sqlx-cli --no-default-features --features mysql
```

### SQLite

```bash
cargo install sqlx-cli --no-default-features --features sqlite
```

---

# 3. Crear proyecto Rust

```bash
cargo new api_rust
cd api_rust
```

---

# 4. Dependencias en Cargo.toml

Ejemplo con **PostgreSQL + Tokio**

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }

sqlx = { version = "0.7", features = [
  "runtime-tokio",
  "postgres",
  "macros",
  "migrate",
  "uuid",
  "chrono"
] }

dotenvy = "0.15"
```

---

# 5. Variables de entorno

Crea un archivo `.env`

```
DATABASE_URL=postgres://user:password@localhost:5432/mydb
```

SQLx lo usa para:

* validar queries
* correr migraciones

---

# 6. Crear migraciones

Inicializa migraciones:

```bash
sqlx migrate add create_users
```

Esto genera:

```
migrations/
  20240310120000_create_users.sql
```

---

# 7. Escribir migración

Ejemplo:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Puedes agregar también `DOWN` usando:

```sql
-- Add migration script here

CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);

-- Add down migration
DROP TABLE users;
```

---

# 8. Ejecutar migraciones

```bash
sqlx migrate run
```

Esto:

* crea tabla `_sqlx_migrations`
* aplica migraciones pendientes

---

# 9. Revertir migración

```bash
sqlx migrate revert
```

Revierte la última migración.

---

# 10. Conexión a la base de datos

Ejemplo básico en Rust:

```rust
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

async fn connect_db() -> PgPool {
    PgPoolOptions::new()
        .max_connections(5)
        .connect("postgres://user:password@localhost/mydb")
        .await
        .unwrap()
}
```

---

# 11. Usar migraciones desde Rust

Puedes ejecutar migraciones automáticamente al iniciar.

```rust
use sqlx::PgPool;

async fn run_migrations(pool: &PgPool) {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .unwrap();
}
```

Ejemplo en `main`:

```rust
#[tokio::main]
async fn main() {
    let pool = connect_db().await;

    run_migrations(&pool).await;
}
```

---

# 12. Insertar datos

```rust
use uuid::Uuid;

sqlx::query!(
    "INSERT INTO users (id, name, email) VALUES ($1, $2, $3)",
    Uuid::new_v4(),
    "Juan",
    "juan@email.com"
)
.execute(&pool)
.await?;
```

---

# 13. Obtener datos

```rust
let users = sqlx::query!(
    "SELECT id, name, email FROM users"
)
.fetch_all(&pool)
.await?;
```

---

# 14. Usar structs

```rust
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
struct User {
    id: Uuid,
    name: String,
    email: String,
}
```

Query:

```rust
let users: Vec<User> = sqlx::query_as::<_, User>(
    "SELECT id, name, email FROM users"
)
.fetch_all(&pool)
.await?;
```

---

# 15. Verificación de queries en compilación

SQLx puede validar queries.

Primero:

```bash
cargo install sqlx-cli
```

Luego:

```bash
cargo sqlx prepare
```

Esto genera:

```
.sqlx/
```

Y permite compilar sin acceso a DB.

---

# 16. Comandos importantes de SQLx CLI

Crear base de datos:
```bash
cargo sqlx database create
```

Crear migración:

```bash
sqlx migrate add nombre_migracion
```

Correr migraciones:

```bash
sqlx migrate run
```

Revertir:

```bash
sqlx migrate revert
```

Ver estado:

```bash
sqlx migrate info
```

Preparar queries:

```bash
cargo sqlx prepare
```

---

# 17. Estructura típica del proyecto

```
project/
│
├─ migrations/
│   ├─ 20240310120000_create_users.sql
│
├─ src/
│   ├─ main.rs
│   ├─ db.rs
│   ├─ models.rs
│
├─ .env
├─ Cargo.toml
```

---

# 18. Buenas prácticas

✔ Usar **PgPool** o **MySqlPool**
✔ Separar **queries en repositorios**
✔ Ejecutar migraciones en startup
✔ Usar `query!` para validación compile-time
✔ Mantener migraciones pequeñas
