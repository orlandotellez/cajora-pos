# Guía completa de Prisma ORM 7 (7.10.1)

## Índice

1. [¿Qué es Prisma?](#qué-es-prisma)
2. [Instalación inicial (desde 0)](#instalación-inicial-desde-0)
3. [Configuración de Prisma ORM 7 (`prisma.config.ts`)](#configuración-de-prisma-orm-7-prismaconfigts)
4. [El cliente generado](#el-cliente-generado)
5. [Driver adapter obligatorio](#driver-adapter-obligatorio)
6. [Flujo de trabajo típico](#flujo-de-trabajo-típico)
7. [Comandos esenciales de Prisma](#comandos-esenciales-de-prisma)
8. [El error común: "Cannot read properties of undefined"](#el-error-común-cannot-read-properties-of-undefined)
9. [CRUD básico con Prisma](#crud-básico-con-prisma)
10. [Relaciones entre modelos](#relaciones-entre-modelos)
11. [Casos especiales](#casos-especiales)
12. [Decimal: cuidado con los tipos numéricos](#decimal-cuidado-con-los-tipos-numéricos)
13. [Troubleshooting común](#troubleshooting-común)
14. [Buenas prácticas](#buenas-prácticas)
15. [Estructura de archivos](#estructura-de-archivos)
16. [Resumen del flujo de desarrollo](#resumen-del-flujo-de-desarrollo)

---

## ¿Qué es Prisma?

Prisma es un **ORM (Object-Relational Mapper)** que te permite trabajar con bases de datos de forma type safe y con una sintaxis más limpia que SQL puro. En lugar de escribir consultas SQL, trabajas con objetos JavaScript/TypeScript.

Este proyecto corre **Prisma ORM 7.10.1**. Si venís de la v6, ojo con tres cambios que se notan enseguida: el cliente generado ya no vive en `node_modules`, `prisma.config.ts` pasó a ser obligatorio y el driver adapter es requerido para todas las bases.

---

## Instalación inicial (desde 0)

### Resetear las migraciones: 

```bash
bunx prisma migrate reset
```

### 1. Instalar las dependencias

```bash
bun add @prisma/client @prisma/adapter-pg
bun add -D prisma
```

En este proyecto las tres están fijadas en `7.10.1` (`prisma`, `@prisma/client` y `@prisma/adapter-pg`). El adapter no es opcional en la v7.

### 2. Inicializar Prisma

```bash
bunx prisma init
```

Esto crea:
- `prisma/schema.prisma` - Donde definís tu modelo de datos
- `prisma.config.ts` - La config del CLI (obligatoria en la v7)
- `.env` - Donde configurás la conexión a la DB

### 3. Configurar el schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Acá definís tus modelos/tablas
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String?
}
```

Dos cambios grandes contra la v6:

- El provider del generator ahora es `prisma-client` y `output` es **obligatorio**: el cliente no se genera más dentro de `node_modules`.
- El `datasource` ya **no** lleva `url`: la connection string se define en `prisma.config.ts`.

Todo el detalle está en [Configuración de Prisma ORM 7](#configuración-de-prisma-orm-7-prismaconfigts).

### 4. Configurar el .env

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/mibase?schema=public"
```

### 5. Generar el cliente de Prisma

```bash
bunx prisma generate
```

O con el script del proyecto:

```bash
bun run prisma:generate
```

Esto genera el código en `src/generated/prisma`, que es de donde lo importa la app (ver [El cliente generado](#el-cliente-generado)).

### 6. Usar Prisma en tu código

```typescript
// src/config/prisma.ts (instancia única)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Usar en tu código
const users = await prisma.user.findMany();
```

⚠️ En la v7 **no** importes `PrismaClient` desde el paquete `@prisma/client`. Ese path ya no sirve para el código de la app: `.prisma/client` no lo llena el generator `prisma-client`, y `@prisma/client@7` resuelve a un stub cuyo entry point revienta en runtime con `MODULE_NOT_FOUND: Cannot find module '@prisma/client/runtime/library.js'`.

---

## Configuración de Prisma ORM 7 (`prisma.config.ts`)

En la v7 `prisma.config.ts` es obligatorio: es donde ahora viven el schema, las migraciones, el seed y la connection string. En este repo el archivo es así:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun src/scripts/seed.ts",
  },
  datasource: {
    // `process.env` is deliberate, NOT the `env()` helper from `prisma/config`.
    // Two separate concerns:
    //  * `dotenv/config` above loads `.env` for the CLI. Prisma ORM 7 does NOT
    //    auto-load `.env` any more, so without it `prisma migrate status` fails with
    //    "The datasource.url property is required". Bun's automatic `.env` loading
    //    applies to the application runtime, not to the Prisma CLI.
    //  * `env()` is still avoided because it THROWS on a missing variable while merely
    //    loading the config. `dotenv.config()` no-ops when `.env` is absent, and the
    //    Dockerfile runs `prisma generate` during the image build with `.env` excluded
    //    by `.dockerignore`, so `env()` would break the Docker build.
    url: process.env["DATABASE_URL"]!,
  },
});
```

Puntos a tener en cuenta:

- **`datasource.url` se define acá, no en el schema.** Por eso el bloque `datasource db` de `prisma/schema.prisma` solo lleva el `provider`.
- **`migrations.seed` apunta a `bun src/scripts/seed.ts`.** En la v7 `migrate dev` y `migrate reset` **ya no** corren el seed automáticamente: si querés datos de prueba, ejecutás `bun run seed` a mano.
- **`process.env["DATABASE_URL"]` es a propósito, y no el helper `env()` de `prisma/config`.** El detalle tiene dos partes y las contamos abajo, porque es justo lo que alguien "prolija" el próximo mes y rompe el CLI o el build de Docker.

### Por qué `prisma.config.ts` carga `dotenv` a mano

Son **dos problemas distintos**, y es fácil mezclarlos:

1. **Prisma ORM 7 ya no carga `.env` solo para el CLI.** Por eso el archivo arranca con `import "dotenv/config";`. Ojo con la confusión fina: el `.env` automático de Bun aplica al **runtime** de la app, no al CLI de Prisma. Si sacás ese import y corrés `bunx prisma migrate status` sin `DATABASE_URL` exportada en el shell, falla con `The datasource.url property is required`.
2. **Igual se evita `env()` de `prisma/config`.** `env()` tira error si la variable falta en el momento en que se carga la config, incluso para comandos que nunca tocan la base (por ejemplo `prisma generate`). El `Dockerfile` corre `prisma generate` durante el build de la imagen y `.dockerignore` excluye `.env`, así que con `env()` el build de Docker se rompe. `dotenv.config()` no hace nada si `.env` no existe, por eso no rompe nada en el build.

Moraleja: no saques el `dotenv/config` "porque Bun ya carga el `.env` solo" ni cambies `process.env` por `env()` "porque queda más limpio". Las dos cosas rompen, y la segunda rompe el build de Docker sin avisar.

---

## El cliente generado

El generator `prisma-client` escribe el cliente en `src/generated/prisma`, porque el schema declara `output = "../src/generated/prisma"` (relativo a `prisma/`). Ya no se genera nada en `node_modules/.prisma`.

¿Por qué importa la ubicación? Porque `tsconfig.json` declara `rootDir: "./src"` e `include: ["src/**/*"]`. Generar el cliente fuera de `src/` rompería `tsc` y el bundle de `tsup`. Adentro de `src/`, compila y se buildea sin config extra.

En el código se importa desde el path generado:

```typescript
import { PrismaClient } from "@/generated/prisma/client";
```

El alias `@/*` mapea a `./src/*` y está declarado tanto en `tsconfig.json` como en `tsup.config.ts` (`esbuildOptions.alias`), así que el mismo import funciona para los tipos, para `bun run` y para el bundle.

El `client.ts` generado además reexporta todos los enums y los alias legacy de tipos de modelo en minúscula (por ejemplo `user`, `sale_item`), así que la mayoría de los imports de tipos que ya tenías siguen funcionando desde ese único path:

```typescript
import type { Prisma, user, sale_item } from "@/generated/prisma/client";
```

Y `src/generated/` está en `.gitignore`: es output de build, se regenera con `bun run prisma:generate` y no se commitea ni se edita a mano.

---

## Driver adapter obligatorio

En la v7 Prisma necesita un **driver adapter** para cada base de datos; ya no hay modo sin adapter. Para PostgreSQL el paquete es `@prisma/adapter-pg`, que es dependencia del proyecto (fijado en `7.10.1` junto con `prisma` y el client).

La instancia vive en `src/config/prisma.ts` y se ve así:

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

La opción `datasourceUrl` del constructor, que se usaba en la v6, fue reemplazada por `adapter`. Si ves `datasourceUrl` dando vueltas, es código viejo.

---

## Flujo de trabajo típico

### Paso 1: Definir o modificar el modelo

Editás `prisma/schema.prisma` agregando/modificando modelos.

```prisma
model Book {
  id        String   @id @default(uuid())
  title     String
  author    String?
  pages     Int
  createdAt DateTime @default(now())
}
```

### Paso 2: Sincronizar con la base de datos

Acá hay DOS comandos principales, y es donde siempre me confundo:

#### Opción A: `prisma db push` (rápido, para desarrollo)

```bash
bunx prisma db push
```

- Sincroniza el schema de Prisma con la DB
- **NO crea migraciones** (no guarda historial)
- Es ideal para desarrollo rápido o prototipos
- Puede advertencia sobre pérdida de datos

#### Opción B: `prisma migrate dev` (para producción)

```bash
bunx prisma migrate dev --name nombre_de_la_migracion
```

O directamente el script que ya combina migración y generate:

```bash
bun run prisma:migrate
```

- Crea un archivo de migración en `prisma/migrations/`
- Guarda historial de cambios
- **Sí preserva los datos** (más seguro)
- Ideal para equipos y producción

⚠️ Desde la v7 `prisma migrate dev` **ya no** corre `prisma generate` solo, y tampoco dispara el seed automático después de migrar. Por eso el script `prisma:migrate` de `package.json` es `prisma migrate dev && prisma generate`: el `&& prisma generate` está ahí justamente porque la v7 dejó de hacerlo implícito.

### Paso 3: Regenerar el cliente

Después de cada cambio en el schema:

```bash
bunx prisma generate
```

O con el script:

```bash
bun run prisma:generate
```

Esto actualiza el código TypeScript que usás en tu app, en `src/generated/prisma`.

---

## Comandos esenciales de Prisma

| Comando | Para qué sirve |
|---------|----------------|
| `bunx prisma init` | Inicializar Prisma desde cero |
| `bunx prisma generate` | Generar el cliente (NECESARIO después de cambios) |
| `bunx prisma db push` | Sincronizar schema con DB (sin migraciones) |
| `bunx prisma migrate dev` | Crear y aplicar migración (con historial) |
| `bunx prisma migrate deploy` | Aplicar migraciones en producción |
| `bunx prisma studio` | UI visual para explorar la DB |
| `bunx prisma db execute` | Ejecutar SQL directamente |
| `bunx prisma format` | Formatear el schema.prisma |
| `bunx prisma migrate reset` | Eliminar las migraciones y empezar desde 0|

### Scripts del proyecto

| Script | Qué corre |
|--------|-----------|
| `bun run prisma:generate` | `prisma generate` |
| `bun run prisma:migrate` | `prisma migrate dev && prisma generate` |
| `bun run prisma:studio` | `prisma studio` |
| `bun run migrate:deploy` | `prisma migrate deploy` |
| `bun run build` | `prisma generate && tsup` |

El `&& prisma generate` de `prisma:migrate` existe porque la v7 dejó de regenerar el cliente al migrar. El de `build` existe porque `src/generated/` está gitignoreado: el bundle necesita generar el cliente antes de compilar.

---

## El error común: "Cannot read properties of undefined"

Este error ocurre cuando:
1. **El servidor está corriendo con el cliente viejo** - Solución: reiniciar el servidor
2. **No ejecutaste `bun run prisma:generate`** - El cliente no tiene el modelo
3. **El modelo no está en el schema.prisma** - No existe la tabla definida
4. **El schema no está sincronizado con la DB** - Falta `db push` o `migrate`

### Cómo diagnosticarlo:

```bash
# 1. Verificar que el schema tiene el modelo
cat prisma/schema.prisma | grep -A5 "model NombreDelModelo"

# 2. Verificar que el cliente lo tiene
grep -r "NombreDelModelo" src/generated/prisma/

# 3. Regenerar cliente
bun run prisma:generate

# 4. Verificar que se generó correctamente
grep -r "NombreDelModelo" src/generated/prisma/
```

Ojo: no busques más en `node_modules/.prisma/client`, el generator `prisma-client` no escribe ahí.

---

## CRUD básico con Prisma

### Create (INSERT)

```typescript
// Crear un registro
const book = await prisma.book.create({
  data: {
    title: "Cien años de soledad",
    author: "Gabriel García Márquez",
    pages: 417,
  },
});
```

### Read (SELECT)

```typescript
// Obtener todos
const books = await prisma.book.findMany();

// Obtener uno por ID
const book = await prisma.book.findUnique({
  where: { id: "uuid-del-libro" },
});

// Filtrar
const garciaBooks = await prisma.book.findMany({
  where: { author: { contains: "García" } },
});
```

### Update (UPDATE)

```typescript
const updatedBook = await prisma.book.update({
  where: { id: "uuid-del-libro" },
  data: {
    title: "Nuevo título",
  },
});
```

### Delete (DELETE)

```typescript
await prisma.book.delete({
  where: { id: "uuid-del-libro" },
});
```

---

## Relaciones entre modelos

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  posts     Post[]   // Relación uno a muchos
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  authorId  String   // Foreign key
  author    User     @relation(fields: [authorId], references: [id]) // Relación
}
```

### Queries con relaciones:

```typescript
// Obtener usuario con sus posts
const userWithPosts = await prisma.user.findUnique({
  where: { id: "uuid" },
  include: {
    posts: true,
  },
});
```

---

## Casos especiales

### Crear tabla sin migraciones (para desarrollo rápido)

```bash
bunx prisma db execute --stdin <<< "CREATE TABLE IF NOT EXISTS \"MiTabla\" (id TEXT PRIMARY KEY);"
```

### Agregar columna sin migraciones

```bash
bunx prisma db execute --stdin <<< "ALTER TABLE \"Book\" ADD COLUMN IF NOT EXISTS \"nuevaColumna\" TEXT;"
```

### Ver la DB visualmente

```bash
bun run prisma:studio
```

Esto abre una UI en `http://localhost:5555` para ver y editar datos.

---

## Decimal: cuidado con los tipos numéricos

Los campos `Decimal` de Prisma (y las proyecciones `numeric`/`Decimal` de las queries crudas) **no** vuelven como `number`: vuelven como `Prisma.Decimal`. Y un `Prisma.Decimal` serializado a JSON queda como **string**, no como número.

Esto muerde porque varias queries crudas de analítica de este repo declaran sus proyecciones `SUM(...)` como `number`, por ejemplo:

```typescript
const rows = await prisma.$queryRawUnsafe<Array<{ date: Date; revenue: number }>>(...)
```

El tipo declarado no convierte nada: en runtime llega un `Prisma.Decimal`. Si sumás, comparás o serializás sin darte cuenta, te quedan cuentas raras o strings donde el front espera números.

Las tres entidades de dominio que manejan plata importan el namespace desde el path generado y usan `Prisma.Decimal`:

```typescript
import type { Prisma } from "@/generated/prisma/client";
```

- `src/modules/sales/domain/sales.entities.ts`
- `src/modules/products/domain/products.entities.ts`
- `src/modules/services/domain/services.entities.ts`

Y no reintroduzcas el import viejo `@prisma/client/runtime/library` para traer `Decimal`: ese path ya no existe en la v7.

---

## Troubleshooting común

### "Drift detected" (la DB no coincide con las migraciones)

Esto pasa cuando la DB se modificó manualmente o con `db push` pero las migraciones no están actualizadas.

**Solución:**
```bash
# Opción 1: Resetear la DB (pierdes datos)
bunx prisma migrate reset

# Opción 2: Aceptar el estado actual y crear una migración
bunx prisma migrate dev --name sync_current_state
```

### "Table does not exist"

1. Verificar que el modelo está en `schema.prisma`
2. Ejecutar `bunx prisma db push` o `bun run prisma:migrate`
3. Ejecutar `bun run prisma:generate`

### El servidor no reconoce el nuevo modelo

**Reiniciar el servidor** - El cliente se carga al inicio, no se actualiza en caliente.

---

## Buenas prácticas

1. **Siempre ejecutar `bun run prisma:generate`** después de cambiar el schema - desde la v7 `migrate dev` ya no lo hace solo
2. **Reiniciar el servidor** después de generate
3. **Usar migraciones** (`migrate dev`) en vez de `db push` para proyectos en equipo
4. **No editar las migraciones a mano** - crear nuevas en su lugar
5. **No editar ni commitear `src/generated/`** - es build output, lo pisa el próximo generate
6. **Hacer backup** antes de migraciones destructivas

---

## Estructura de archivos

```
backend-fastify/
├── prisma/
│   ├── schema.prisma        ← Tus modelos
│   └── migrations/          ← Historial de cambios
│       └── 20240101_init/
│           └── migration.sql
├── prisma.config.ts         ← Config del CLI (obligatoria en v7)
├── src/
│   ├── generated/
│   │   └── prisma/          ← Cliente generado (gitignoreado, NO editar)
│   ├── config/
│   │   └── prisma.ts        ← Instancia única + driver adapter
│   └── tu-codigo.ts
└── .gitignore               ← Ignora src/generated/
```

`src/generated/` está en `.gitignore` porque es output de build: lo regenera `bun run prisma:generate`, no se commitea y no se edita a mano.

---

## Resumen del flujo de desarrollo

```
1. Editás schema.prisma
2. Ejecutás bun run prisma:migrate (migrate dev + generate) o, para dev rápido, bunx prisma db push
3. Si usaste db push, regenerás el cliente: bun run prisma:generate
4. Reiniciás el servidor
5. Usás prisma.modelo.metodo() en tu código
```

¡Con esto ya sabés lo básico de Prisma para trabajar! 🚀
