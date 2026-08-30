-- Adds a category to bank requests so "personal expense" withdrawals
-- (capped at 10% of a member's lifetime donations, enforced in the API
-- route) can be told apart from general family-business requests.
CREATE TYPE "BankRequestCategory" AS ENUM ('GENERAL', 'PERSONAL_EXPENSE');

ALTER TABLE "BankRequest" ADD COLUMN "category" "BankRequestCategory" NOT NULL DEFAULT 'GENERAL';
