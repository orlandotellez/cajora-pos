import type { FastifyCorsOptions } from "@fastify/cors";

export const corsOptions: FastifyCorsOptions = {
  origin: process.env.CORS_ORIGIN?.split(",") ?? [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1420",
    "http://192.168.0.10:1420",
    "http://tauri.localhost",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};
