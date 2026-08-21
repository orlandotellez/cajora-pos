-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '[]';
