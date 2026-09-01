// lib/funding.ts
// Single choke point for "where did the money for this family expense come
// from" — called by every expense-issuing route (event bonuses today; car
// purchases, house payments, etc. can call the same helper later) instead
// of each one reimplementing the donation/IOU logic separately.
//
// Three outcomes:
//  - FAMILY_BALANCE:            expense comes straight out of FamilyBalance.
//  - PERSONAL_ACCOUNT + DONATION:   a DONATION transaction is created and
//      credited to FamilyBalance first (so the payer gets normal donation
//      credit/leaderboard stats), then the expense is deducted as usual —
//      net effect is transparent in the audit trail even though it's close
//      to a wash.
//  - PERSONAL_ACCOUNT + REIMBURSABLE: FamilyBalance is NOT touched by the
//      expense at all (the member already paid it personally) — instead an
//      OWED Reimbursement row is created so the family can pay them back
//      later without it ever counting as a donation.
//
// Caller is responsible for wrapping this in the same prisma.$transaction
// as everything else the route is doing, same as applyBalanceDelta.

import { Prisma, PrismaClient, FundingSource, PersonalIntent } from "@prisma/client";
import { applyBalanceDelta } from "@/lib/balance";
import { calculateTax } from "@/lib/tax";

type TxClient = PrismaClient | Prisma.TransactionClient;

export interface FundingInput {
  source: FundingSource;
  personalIntent?: PersonalIntent; // required when source === PERSONAL_ACCOUNT
}

export async function resolveExpenseFunding(
  tx: TxClient,
  {
    funding,
    amount,
    userId, // who fronted the money, if PERSONAL_ACCOUNT
    approvedById,
    expenseLabel, // e.g. "Event win bonus — Turf War"
    refType, // e.g. "EVENT_BONUS"
    refId,
  }: {
    funding: FundingInput;
    amount: number;
    userId: string;
    approvedById: string;
    expenseLabel: string;
    refType: string;
    refId?: string;
  }
) {
  if (funding.source === "FAMILY_BALANCE") {
    await applyBalanceDelta(tx, -amount, refType, refId);
    return { donationTransactionId: null, reimbursementId: null };
  }

  // PERSONAL_ACCOUNT from here on.
  if (funding.personalIntent === "DONATION") {
    const breakdown = calculateTax(amount, "DONATION");

    const donation = await tx.transaction.create({
      data: {
        type: "DONATION",
        category: "DONATION",
        originalAmount: breakdown.originalAmount,
        taxAmount: breakdown.taxAmount,
        finalAmount: breakdown.finalAmount,
        note: `Covered personally: ${expenseLabel}`,
        userId,
        status: "APPROVED",
        reviewedById: approvedById,
        reviewedAt: new Date(),
      },
    });

    await applyBalanceDelta(tx, breakdown.finalAmount, `${refType}_PERSONAL_DONATION`, donation.id);
    // The expense itself still leaves the family balance as normal —
    // the donation above is what replenished it.
    await applyBalanceDelta(tx, -amount, refType, refId);

    return { donationTransactionId: donation.id, reimbursementId: null };
  }

  // REIMBURSABLE — family balance is untouched by the expense; it now
  // owes the member instead. Paid back later via /api/reimbursements/[id]/pay.
  const reimbursement = await tx.reimbursement.create({
    data: {
      userId,
      amount,
      reason: expenseLabel,
      refType,
      refId,
      status: "OWED",
    },
  });

  return { donationTransactionId: null, reimbursementId: reimbursement.id };
}
