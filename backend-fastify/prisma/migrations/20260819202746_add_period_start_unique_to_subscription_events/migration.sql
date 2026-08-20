-- AlterTable
ALTER TABLE "subscription_events" ADD COLUMN     "period_start" TIMESTAMPTZ;

-- Backfill: para los cobros ya registrados (webhook_sale_completed) el inicio del
-- período coincide con created_at (momento en que se registró el cobro). Los
-- eventos de auditoría quedan en NULL (no son cobros y no colisionan en la UNIQUE).
UPDATE "subscription_events"
SET "period_start" = "created_at"
WHERE "action" = 'webhook_sale_completed'
  AND "period_start" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_store_id_action_paypal_subscription_id__key" ON "subscription_events"("store_id", "action", "paypal_subscription_id", "period_start");