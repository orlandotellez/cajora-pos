/*
  Warnings:

  - You are about to drop the column `paper_size` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_cut_after` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_interface` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_ip` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_name` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_open_drawer` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `printer_port` on the `settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "settings" DROP COLUMN "paper_size",
DROP COLUMN "printer_cut_after",
DROP COLUMN "printer_interface",
DROP COLUMN "printer_ip",
DROP COLUMN "printer_name",
DROP COLUMN "printer_open_drawer",
DROP COLUMN "printer_port";

-- CreateIndex
CREATE INDEX "products_store_id_deleted_at_idx" ON "products"("store_id", "deleted_at");

-- CreateIndex
CREATE INDEX "products_store_id_name_idx" ON "products"("store_id", "name");
