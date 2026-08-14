-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "store_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "paypal_subscription_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_events_store_id_created_at_idx" ON "subscription_events"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_events_user_id_idx" ON "subscription_events"("user_id");

-- CreateIndex
CREATE INDEX "subscription_events_action_idx" ON "subscription_events"("action");

-- CreateIndex
CREATE INDEX "subscription_events_created_at_idx" ON "subscription_events"("created_at");

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
