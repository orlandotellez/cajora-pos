-- Drop IVA-related columns (tax_rate, tax_total) from products, sales, sale_items, settings.
-- This migration removes all tax/IVA functionality from the POS.
-- IF EXISTS makes the migration safe to replay or run against environments where
-- the columns may have been removed manually.

ALTER TABLE "products" DROP COLUMN IF EXISTS "tax_rate";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "tax_total";
ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "tax_rate";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "tax_rate";
