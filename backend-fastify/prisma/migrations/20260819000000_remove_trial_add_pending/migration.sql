-- Remove the 14-day free trial: users must pay immediately.
-- Postgres can't drop enum values without recreating the type, so we first
-- relax the column to TEXT, migrate existing rows, then recreate the enum.

ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT;

-- Existing trial rows lose access until they pay (pay-immediately model).
UPDATE "subscriptions" SET status='pending' WHERE status='trial';

DROP TYPE "SUBSCRIPTION_STATUS";
CREATE TYPE "SUBSCRIPTION_STATUS" AS ENUM ('pending', 'active', 'past_due', 'canceled', 'expired');
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SUBSCRIPTION_STATUS" USING "status"::"SUBSCRIPTION_STATUS";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "subscriptions" DROP COLUMN "trial_ends_at";