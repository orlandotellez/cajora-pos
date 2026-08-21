-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "unit_cost" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "cash_expenses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "source_type" TEXT,
    "ref_id" TEXT,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cash_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_expenses_session_id_idx" ON "cash_expenses"("session_id");

-- CreateIndex
CREATE INDEX "cash_expenses_store_id_created_at_idx" ON "cash_expenses"("store_id", "created_at");

-- AddForeignKey
ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
