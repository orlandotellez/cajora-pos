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
