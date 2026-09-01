-- Adds admin-manageable, human-facing transaction categories (car
-- insurance, license plate, house payment, business profit, etc.) on top
-- of the existing fixed TransactionType enum, so admins can add or retire
-- categories from the UI (see /money/categories) without a code deploy.
-- Also adds duration + collateral fields to Loan requests.

CREATE TYPE "CategoryDirection" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "TransactionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "CategoryDirection" NOT NULL,
    "group" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCategory_name_key" ON "TransactionCategory"("name");
CREATE INDEX "TransactionCategory_direction_idx" ON "TransactionCategory"("direction");
CREATE INDEX "TransactionCategory_isActive_idx" ON "TransactionCategory"("isActive");

ALTER TABLE "Transaction" ADD COLUMN "customCategoryId" TEXT;
CREATE INDEX "Transaction_customCategoryId_idx" ON "Transaction"("customCategoryId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customCategoryId_fkey"
    FOREIGN KEY ("customCategoryId") REFERENCES "TransactionCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "Loan" ADD COLUMN "collateralItems" TEXT;
ALTER TABLE "Loan" ADD COLUMN "collateralValue" DECIMAL(12,2);

-- Seed the requested categories, grouped for a readable admin/picker UI.
-- All of these file under OTHER_INCOME or OTHER_EXPENSE at the
-- TransactionType level — TransactionCategory is just the human label.
INSERT INTO "TransactionCategory" ("id", "name", "direction", "group", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Fuel',                       'EXPENSE', 'Vehicles', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Car Insurance',               'EXPENSE', 'Vehicles', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Recall / Repair',             'EXPENSE', 'Vehicles', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'License Plate',               'EXPENSE', 'Vehicles', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Car Purchase',                'EXPENSE', 'Vehicles', 50, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Ammunition',                  'EXPENSE', 'Supplies', 10, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Business Purchase',           'EXPENSE', 'Business', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business Investment',         'EXPENSE', 'Business', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business Upkeep / Supplies',  'EXPENSE', 'Business', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business Loss',                'EXPENSE', 'Business', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business Profit',              'INCOME',  'Business', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business Sale',                'INCOME',  'Business', 60, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Raid Income',                  'INCOME',  'Family Raids', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Raid Loss',                     'EXPENSE', 'Family Raids', 20, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'House Payment',                'EXPENSE', 'House', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'House Insurance',               'EXPENSE', 'House', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'House Improvement',             'EXPENSE', 'House', 30, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Sponsorship / Prize Winnings',  'INCOME',  'Income', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Territory Capture Reward',      'INCOME',  'Income', 20, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Salary / Rank Bonus',           'EXPENSE', 'Payroll', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Recruitment Bonus',             'EXPENSE', 'Payroll', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Fines / Strike Deduction',      'EXPENSE', 'Payroll', 30, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Bail',                          'EXPENSE', 'Legal / Risk', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Court Fines',                   'EXPENSE', 'Legal / Risk', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bribes',                        'EXPENSE', 'Legal / Risk', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Medical Bills',                 'EXPENSE', 'Legal / Risk', 40, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Turf Upkeep',                   'EXPENSE', 'Territory', 10, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Event Prize Payout',            'EXPENSE', 'Events', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Event Entry Fee',                'EXPENSE', 'Events', 20, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'Server / Hosting Costs',        'EXPENSE', 'Overhead', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Charity / Community Donation',  'EXPENSE', 'Overhead', 20, CURRENT_TIMESTAMP);
