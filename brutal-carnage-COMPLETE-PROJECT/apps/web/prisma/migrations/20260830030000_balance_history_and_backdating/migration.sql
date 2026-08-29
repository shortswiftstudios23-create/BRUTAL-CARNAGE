-- Balance history (fixes the dashboard chart being hardcoded mock data)
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "delta" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalanceSnapshot_createdAt_idx" ON "BalanceSnapshot"("createdAt");

-- Seed one snapshot from the current balance so the chart has a starting
-- point immediately after migrating, instead of an empty history.
INSERT INTO "BalanceSnapshot" ("id", "balance", "delta", "reason", "createdAt")
SELECT 'seed_' || "id", "balance", "balance", 'MIGRATION_SEED', COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "FamilyBalance"
WHERE "id" = 'singleton';

-- Backdated logging support ("log for yesterday / day before yesterday")
ALTER TABLE "ItemAction" ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "occurredAt" TIMESTAMP(3);
