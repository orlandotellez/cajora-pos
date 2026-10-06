-- CreateEnum
CREATE TYPE "USER_ACCESS" AS ENUM ('enabled', 'restricted');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "access_status" "USER_ACCESS" NOT NULL DEFAULT 'enabled';
