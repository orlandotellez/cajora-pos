-- DropIndex
DROP INDEX "inventory_batches_created_at_idx";

-- DropIndex
DROP INDEX "inventory_batches_movement_type_idx";

-- DropIndex
DROP INDEX "inventory_batches_store_id_idx";

-- DropIndex
DROP INDEX "inventory_movements_created_at_idx";

-- DropIndex
DROP INDEX "inventory_movements_movement_type_idx";

-- DropIndex
DROP INDEX "inventory_movements_store_id_idx";

-- DropIndex
DROP INDEX "sales_created_at_idx";

-- DropIndex
DROP INDEX "sales_store_id_idx";

-- CreateIndex
CREATE INDEX "inventory_batches_store_id_created_at_idx" ON "inventory_batches"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_batches_store_id_movement_type_idx" ON "inventory_batches"("store_id", "movement_type");

-- CreateIndex
CREATE INDEX "inventory_movements_store_id_created_at_idx" ON "inventory_movements"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_store_id_movement_type_idx" ON "inventory_movements"("store_id", "movement_type");

-- CreateIndex
CREATE INDEX "sales_store_id_created_at_idx" ON "sales"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "services_store_id_deleted_at_idx" ON "services"("store_id", "deleted_at");

-- CreateIndex
CREATE INDEX "services_store_id_name_idx" ON "services"("store_id", "name");

-- CreateIndex
CREATE INDEX "suppliers_store_id_deleted_at_idx" ON "suppliers"("store_id", "deleted_at");

-- CreateIndex
CREATE INDEX "suppliers_store_id_name_idx" ON "suppliers"("store_id", "name");

-- CreateIndex
CREATE INDEX "users_store_id_deleted_at_idx" ON "users"("store_id", "deleted_at");
