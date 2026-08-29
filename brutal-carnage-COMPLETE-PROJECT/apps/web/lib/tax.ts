// lib/tax.ts
// Single source of truth for the 3% tax on Donations and Withdrawals.
// Every place that shows or applies tax imports from here — never
// hardcode "* 0.03" inline, so the rate only has to change in one spot.

import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";

export const TAXED_TYPES: TransactionType[] = ["DONATION", "WITHDRAWAL"];
// SOLD_ITEMS is deliberately untaxed and deliberately NOT counted as a
// personal donation — it's family inventory converted to cash, credited
// under the seller's name for logging/audit purposes only. It must never
// feed into the donation leaderboard (see leaderboard query in Step 7).
export const TAX_RATE = 0.03;

export interface TaxBreakdown {
  originalAmount: number;
  taxAmount: number;
  finalAmount: number;
  isTaxed: boolean;
}

export function calculateTax(amount: number, type: TransactionType): TaxBreakdown {
  const isTaxed = TAXED_TYPES.includes(type);

  if (!isTaxed) {
    return { originalAmount: amount, taxAmount: 0, finalAmount: amount, isTaxed: false };
  }

  const original = new Decimal(amount);
  const tax = original.times(TAX_RATE).toDecimalPlaces(2);

  // Donations: tax is deducted from what reaches the family balance.
  // Withdrawals: tax is added on top of what the member requested,
  // so the family balance loses (requested + tax), and the member
  // still receives exactly what they asked for.
  const final =
    type === "DONATION" ? original.minus(tax) : original.plus(tax);

  return {
    originalAmount: original.toNumber(),
    taxAmount: tax.toNumber(),
    finalAmount: final.toNumber(),
    isTaxed: true,
  };
}
