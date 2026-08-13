-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_store_id_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
