-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "paper_size" TEXT,
ADD COLUMN     "printer_cut_after" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "printer_interface" TEXT,
ADD COLUMN     "printer_ip" TEXT,
ADD COLUMN     "printer_name" TEXT,
ADD COLUMN     "printer_open_drawer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printer_port" INTEGER;
