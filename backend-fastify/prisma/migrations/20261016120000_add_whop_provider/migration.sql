-- CreateEnum
CREATE TYPE "SUBSCRIPTION_PROVIDER" AS ENUM ('paypal', 'whop');

-- AlterTable: proveedor dueño de la fila + vínculo con Whop.
-- El default 'paypal' clasifica correctamente las filas existentes sin backfill:
-- todas las suscripciones anteriores a esta migración las cobra PayPal.
ALTER TABLE "subscriptions" ADD COLUMN     "provider" "SUBSCRIPTION_PROVIDER" NOT NULL DEFAULT 'paypal';
ALTER TABLE "subscriptions" ADD COLUMN     "whop_membership_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN     "whop_user_id" TEXT;

-- CreateTable: outbox de webhooks de Whop (espejo de paypal_webhook_events).
-- Whop entrega "at least once" y reintenta con el mismo `webhook-id`, que se guarda
-- en event_id: la UNIQUE es el corte de idempotencia.
CREATE TABLE "whop_webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "whop_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_whop_membership_id_key" ON "subscriptions"("whop_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "whop_webhook_events_event_id_key" ON "whop_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "whop_webhook_events_event_type_idx" ON "whop_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "whop_webhook_events_received_at_idx" ON "whop_webhook_events"("received_at");
