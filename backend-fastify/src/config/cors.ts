import type { FastifyCorsOptions } from "@fastify/cors";

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") ?? [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://192.168.0.10:4321",
  "http://localhost:1420",
  "http://192.168.0.10:1420",
  "http://tauri.localhost",
]

export const corsOptions: FastifyCorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

export function isOriginAllowed(origin: string): boolean {
  return allowedOrigins.includes(origin)
}
