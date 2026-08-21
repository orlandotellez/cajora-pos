-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cash_session_id" TEXT;

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'abierto',
    "opening_amount" DECIMAL(10,2) NOT NULL,
    "closing_amount_counted" DECIMAL(10,2),
    "expected_amount" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "observations" TEXT,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_sessions_store_id_status_idx" ON "cash_sessions"("store_id", "status");

-- CreateIndex
CREATE INDEX "cash_sessions_store_id_opened_at_idx" ON "cash_sessions"("store_id", "opened_at");

-- CreateIndex
CREATE INDEX "cash_sessions_user_id_status_idx" ON "cash_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "sales_cash_session_id_idx" ON "sales"("cash_session_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
