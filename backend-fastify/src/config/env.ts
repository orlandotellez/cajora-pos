import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string(),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  PAYPAL_ENABLED: z.string().default("false").transform((v) => v === "true"),
  PAYPAL_SANDBOX: z.string().default("true").transform((v) => v === "true"),
  PAYPAL_CLIENT_ID: z.string().default(""),
  PAYPAL_CLIENT_SECRET: z.string().default(""),
  PAYPAL_WEBHOOK_ID: z.string().default(""),
  PAYPAL_PLAN_ID_MONTHLY: z.string().default(""),
  APP_MODE: z.enum(["cloud", "self_hosted"]).default("self_hosted"),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("CajoraPOS <no-reply@cajorapos.com>"),

  RECONCILE_INTERVAL_MS: z.coerce.number().default(3_600_000),
  RECONCILE_ON_START: z.string().default("true").transform((v) => v === "true"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables", _env.error.format());
  process.exit(1);
}

export const env = _env.data;
