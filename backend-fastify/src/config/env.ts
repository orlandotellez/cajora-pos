import { z } from "zod";
import dotenv from "dotenv";
import { logger } from "./logger";

dotenv.config();

export const envSchema = z.object({
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

  WHOP_ENABLED: z.string().default("false").transform((v) => v === "true"),
  // Default producción a propósito: pasar a sandbox tiene que ser explícito, porque el
  // default contrario mandaría datos de prueba a la cuenta real (o al revés) sin que
  // nadie lo pida. PayPal usa el default opuesto; acá se prioriza no sorprender.
  WHOP_SANDBOX: z.string().default("false").transform((v) => v === "true"),

  // Verificación de correo al crear la cuenta. Con `false` la cuenta nace verificada y no
  // se envía ningún código: sirve para dar de alta tiendas en desarrollo sin depender de un
  // email real ni de RESEND_API_KEY. NO se permite en producción (ver el `refine` de abajo).
  EMAIL_VERIFICATION: z.string().default("true").transform((v) => v === "true"),
  WHOP_API_KEY: z.string().default(""),
  WHOP_WEBHOOK_SECRET: z.string().default(""),
  WHOP_PLAN_ID_MONTHLY: z.string().default(""),
  WHOP_CHECKOUT_REF_SECRET: z.string().default(""),

  APP_MODE: z.enum(["cloud", "self_hosted"]).default("self_hosted"),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("CajoraPOS <no-reply@cajorapos.com>"),

  RECONCILE_INTERVAL_MS: z.coerce.number().default(3_600_000),
  RECONCILE_ON_START: z.string().default("true").transform((v) => v === "true"),
}).refine((data) => !(data.NODE_ENV === "production" && !data.EMAIL_VERIFICATION), {
  // Fail closed: desactivar la verificación crea cuentas ya verificadas, así que en
  // producción cualquiera podría registrarse con un email ajeno. Preferimos que el
  // proceso no arranque antes que aceptar altas sin comprobar el correo.
  message:
    "EMAIL_VERIFICATION=false no se permite con NODE_ENV=production: crearía usuarios ya verificados sin comprobar el correo.",
  path: ["EMAIL_VERIFICATION"],
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  logger.error({ details: _env.error.format() }, "Invalid environment variables");
  process.exit(1);
}

export const env = _env.data;
