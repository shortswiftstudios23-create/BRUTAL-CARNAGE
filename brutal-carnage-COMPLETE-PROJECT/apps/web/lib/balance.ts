// lib/balance.ts
// Single choke point for changing FamilyBalance.balance. Every route that
// used to call `prisma.familyBalance.upsert/update(...)` directly should
// call `applyBalanceDelta` instead, inside the same `prisma.$transaction`
// as everything else it's doing.
//
// Why this exists: the dashboard's "balance trend" chart used to be
// hardcoded mock data because there was no historical record of the
// balance anywhere — only the current singleton value. This helper
// writes a BalanceSnapshot row (balance-after, delta, reason, ref)
// every single time the balance changes, so the chart (and anywhere
// else that wants "what was the balance on date X") can read real
// history instead of guessing.

import { Prisma, PrismaClient } from "@prisma/client";

// Accepts either the top-level PrismaClient or a $transaction client —
// both expose the same familyBalance/balanceSnapshot delegates.
type TxClient = PrismaClient | Prisma.TransactionClient;

export async function applyBalanceDelta(
  tx: TxClient,
  delta: number,
  reason: string,
  refId?: string
) {
  const updated = await tx.familyBalance.upsert({
    where: { id: "singleton" },
    update: { balance: { increment: delta } },
    create: { id: "singleton", balance: delta },
  });

  await tx.balanceSnapshot.create({
    data: {
      balance: updated.balance,
      delta,
      reason,
      refId,
    },
  });

  return updated;
}
