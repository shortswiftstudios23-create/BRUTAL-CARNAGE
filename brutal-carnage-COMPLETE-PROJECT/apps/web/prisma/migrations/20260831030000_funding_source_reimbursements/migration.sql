-- Adds funding-source tracking for family expenses: whenever an admin
-- issues a family expense (starting with event bonuses), they record
-- whether it came out of the family balance or someone's personal
-- account, and — if personal — whether it should count as a donation or
-- be owed back to them later. See lib/funding.ts.

CREATE TYPE "FundingSource" AS ENUM ('FAMILY_BALANCE', 'PERSONAL_ACCOUNT');
CREATE TYPE "PersonalIntent" AS ENUM ('DONATION', 'REIMBURSABLE');
CREATE TYPE "ReimbursementStatus" AS ENUM ('OWED', 'PAID');

CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'OWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reimbursement_userId_idx" ON "Reimbursement"("userId");
CREATE INDEX "Reimbursement_status_idx" ON "Reimbursement"("status");

ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
