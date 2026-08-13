-- CreateEnum
CREATE TYPE "BILLING_MODE" AS ENUM ('cloud', 'self_hosted');

-- CreateEnum
CREATE TYPE "SUBSCRIPTION_STATUS" AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "SUBSCRIPTION_PLAN" AS ENUM ('monthly', 'annual');

-- CreateTable: suscripción por tienda (cloud $15.99/mes vs self_hosted gratis).
-- El trial de 14 días es estado interno (status='trial') sin suscripción PayPal; la tarjeta se
-- pide al suscribirse (checkout) — decisión D0.2 del modelo de negocio.
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "mode" "BILLING_MODE" NOT NULL DEFAULT 'self_hosted',
    "plan" "SUBSCRIPTION_PLAN" NOT NULL DEFAULT 'monthly',
    "status" "SUBSCRIPTION_STATUS" NOT NULL DEFAULT 'active',
    "paypal_subscription_id" TEXT,
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: outbox de webhooks de PayPal. UNIQUE event_id = dedup frente a los reintentos
-- de PayPal (patrón PayPalWebhookEvent de CURSINET-REPO).
CREATE TABLE "paypal_webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "paypal_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_store_id_key" ON "subscriptions"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paypal_subscription_id_key" ON "subscriptions"("paypal_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "paypal_webhook_events_event_id_key" ON "paypal_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "paypal_webhook_events_event_type_idx" ON "paypal_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "paypal_webhook_events_received_at_idx" ON "paypal_webhook_events"("received_at");

-- AddForeignKey: una tienda puede tener como máximo una suscripción (store_id único arriba)
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
