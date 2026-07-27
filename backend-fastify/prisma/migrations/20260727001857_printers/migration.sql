-- CreateEnum
CREATE TYPE "PRINTER_CONN_TYPE" AS ENUM ('net', 'usb', 'bluetooth');

-- CreateEnum
CREATE TYPE "PRINTER_PROFILE" AS ENUM ('escpos', 'star_line');

-- CreateEnum
CREATE TYPE "PRINTER_STATUS" AS ENUM ('unknown', 'online', 'offline', 'error', 'out_of_paper');

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connection_type" "PRINTER_CONN_TYPE" NOT NULL,
    "address" TEXT NOT NULL,
    "port" INTEGER,
    "paper_width" INTEGER NOT NULL,
    "profile" "PRINTER_PROFILE" NOT NULL DEFAULT 'escpos',
    "codepage" TEXT NOT NULL DEFAULT 'PC850',
    "auto_cut" BOOLEAN NOT NULL DEFAULT true,
    "cut_type" TEXT,
    "open_cash_drawer" BOOLEAN NOT NULL DEFAULT false,
    "default_copies" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_status" "PRINTER_STATUS" NOT NULL DEFAULT 'unknown',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_assignments" (
    "id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "category_id" TEXT,
    "role" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "printer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "sale_id" TEXT,
    "payload" BYTEA NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error_msg" TEXT,
    "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "printers_store_id_is_active_idx" ON "printers"("store_id", "is_active");

-- CreateIndex
CREATE INDEX "printers_store_id_is_default_idx" ON "printers"("store_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "printers_store_id_name_key" ON "printers"("store_id", "name");

-- CreateIndex
CREATE INDEX "printer_assignments_printer_id_idx" ON "printer_assignments"("printer_id");

-- CreateIndex
CREATE INDEX "printer_assignments_category_id_idx" ON "printer_assignments"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "printer_assignments_printer_id_category_id_key" ON "printer_assignments"("printer_id", "category_id");

-- CreateIndex
CREATE INDEX "print_jobs_printer_id_status_idx" ON "print_jobs"("printer_id", "status");

-- CreateIndex
CREATE INDEX "print_jobs_status_enqueued_at_idx" ON "print_jobs"("status", "enqueued_at");

-- CreateIndex
CREATE INDEX "print_jobs_sale_id_idx" ON "print_jobs"("sale_id");

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_assignments" ADD CONSTRAINT "printer_assignments_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
