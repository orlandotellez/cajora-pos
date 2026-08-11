-- AlterTable: el super admin no pertenece a ninguna tienda (solo observa el panel global).
ALTER TABLE "users" ALTER COLUMN "store_id" DROP NOT NULL;
