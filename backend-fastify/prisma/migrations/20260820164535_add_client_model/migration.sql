-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "client_id" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");

-- CreateIndex
CREATE INDEX "clients_store_id_idx" ON "clients"("store_id");

-- CreateIndex
CREATE INDEX "clients_store_id_deleted_at_idx" ON "clients"("store_id", "deleted_at");

-- CreateIndex
CREATE INDEX "clients_store_id_name_idx" ON "clients"("store_id", "name");

-- CreateIndex
CREATE INDEX "sales_client_id_idx" ON "sales"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
