// lib/personalExpense.ts
// "Personal expense" bank requests let a member pull money out of the
// family balance for themselves, capped at 10% of everything they've
// personally donated lifetime — money donated AND items donated (valued
// at suggestedPrice), added together — minus whatever they've already
// taken out this way. Both the create route and the review route call
// this so the cap is enforced the same way whether it's the member
// submitting or an officer approving.

import { prisma } from "@/lib/prisma";
import { getContributionEntry } from "@/lib/contributions";

export const PERSONAL_EXPENSE_CAP_RATE = 0.1;

export async function getPersonalExpenseAllowance(userId: string, excludeRequestId?: string) {
  const [contribution, used] = await Promise.all([
    getContributionEntry(userId),
    prisma.bankRequest.aggregate({
      where: {
        userId,
        category: "PERSONAL_EXPENSE",
        status: { in: ["PENDING", "APPROVED"] },
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
      },
      _sum: { amount: true },
    }),
  ]);

  // totalWorthContributed = moneyDonated + itemsDonatedValue (approved only)
  const totalDonated = contribution.totalWorthContributed;
  const alreadyUsed = Number(used._sum.amount ?? 0);
  const cap = Math.round(totalDonated * PERSONAL_EXPENSE_CAP_RATE * 100) / 100;
  const remaining = Math.max(0, Math.round((cap - alreadyUsed) * 100) / 100);

  return {
    totalDonated,
    moneyDonated: contribution.moneyDonated,
    itemsDonatedValue: contribution.itemsDonatedValue,
    cap,
    alreadyUsed,
    remaining,
  };
}
