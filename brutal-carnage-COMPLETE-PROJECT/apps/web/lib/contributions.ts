// lib/contributions.ts
// Single source of truth for "how much has this member contributed /
// taken", so the dashboard's top-contributors widget, the full
// /leaderboard page, the /members table, and the per-member performance
// page all show the exact same numbers instead of drifting out of sync
// (the dashboard widget used to just count raw ItemAction rows, which is
// why it disagreed with the real leaderboard page).
//
// Rules encoded here:
//  - Only APPROVED rows count.
//  - Money donated: Transaction type=DONATION.
//  - Items donated: ItemAction type=DONATE, valued at the item's
//    suggestedPrice at time of read (matches /inventory's valuation).
//  - Items taken: ItemAction type=TAKE, PERSONAL purpose only —
//    FOR_SALE takes are a business action (the item is being listed for
//    the family, see ResaleListing.isFamilyStock) and must never count
//    against the member.
//  - "Net worth contributed" = moneyDonated + itemsDonatedValue - itemsTakenValue.

import { prisma } from "./prisma";

export interface ContributionEntry {
  userId: string;
  moneyDonated: number;
  moneyWithdrawn: number;
  itemsDonatedValue: number;
  itemsTakenValue: number; // PERSONAL takes only
  itemsTakenForSaleValue: number; // FOR_SALE takes, tracked separately, never counted against the member
  eventsAttended: number;
  eventsRegistered: number;
  actionsCount: number; // raw activity count, still useful as a tiebreaker/engagement signal
  netContributed: number; // moneyDonated + itemsDonatedValue - itemsTakenValue
  totalWorthContributed: number; // moneyDonated + itemsDonatedValue (what the public leaderboard ranks by)
}

export async function getContributionLedger(userIds?: string[]): Promise<Map<string, ContributionEntry>> {
  const userFilter = userIds ? { userId: { in: userIds } } : {};

  const [donations, withdrawals, itemActions, eventCounts, eventAttended, actionCounts] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { type: "DONATION", status: "APPROVED", ...userFilter },
      _sum: { finalAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { type: "WITHDRAWAL", status: "APPROVED", ...userFilter },
      _sum: { finalAmount: true },
    }),
    prisma.itemAction.findMany({
      where: { status: "APPROVED", type: { in: ["DONATE", "TAKE"] }, ...userFilter },
      select: { userId: true, type: true, purpose: true, quantity: true, item: { select: { suggestedPrice: true } } },
    }),
    prisma.eventRegistration.groupBy({
      by: ["userId"],
      where: userFilter,
      _count: { _all: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["userId"],
      where: { attended: true, ...userFilter },
      _count: { _all: true },
    }),
    prisma.itemAction.groupBy({
      by: ["userId"],
      where: { status: "APPROVED", ...userFilter },
      _count: { _all: true },
    }),
  ]);

  const entries = new Map<string, ContributionEntry>();

  const ensure = (userId: string): ContributionEntry => {
    let e = entries.get(userId);
    if (!e) {
      e = {
        userId,
        moneyDonated: 0,
        moneyWithdrawn: 0,
        itemsDonatedValue: 0,
        itemsTakenValue: 0,
        itemsTakenForSaleValue: 0,
        eventsAttended: 0,
        eventsRegistered: 0,
        actionsCount: 0,
        netContributed: 0,
        totalWorthContributed: 0,
      };
      entries.set(userId, e);
    }
    return e;
  };

  for (const d of donations) ensure(d.userId).moneyDonated = Number(d._sum.finalAmount ?? 0);
  for (const w of withdrawals) ensure(w.userId).moneyWithdrawn = Number(w._sum.finalAmount ?? 0);

  for (const a of itemActions) {
    const entry = ensure(a.userId);
    const value = Number(a.item.suggestedPrice) * a.quantity;
    if (a.type === "DONATE") {
      entry.itemsDonatedValue += value;
    } else if (a.type === "TAKE") {
      if (a.purpose === "FOR_SALE") {
        entry.itemsTakenForSaleValue += value;
      } else {
        entry.itemsTakenValue += value;
      }
    }
  }

  for (const r of eventCounts) ensure(r.userId).eventsRegistered = r._count._all;
  for (const r of eventAttended) ensure(r.userId).eventsAttended = r._count._all;
  for (const r of actionCounts) ensure(r.userId).actionsCount = r._count._all;

  for (const e of entries.values()) {
    e.totalWorthContributed = e.moneyDonated + e.itemsDonatedValue;
    e.netContributed = e.totalWorthContributed - e.itemsTakenValue;
  }

  return entries;
}

export async function getContributionEntry(userId: string): Promise<ContributionEntry> {
  const ledger = await getContributionLedger([userId]);
  return (
    ledger.get(userId) ?? {
      userId,
      moneyDonated: 0,
      moneyWithdrawn: 0,
      itemsDonatedValue: 0,
      itemsTakenValue: 0,
      itemsTakenForSaleValue: 0,
      eventsAttended: 0,
      eventsRegistered: 0,
      actionsCount: 0,
      netContributed: 0,
      totalWorthContributed: 0,
    }
  );
}

// Top N by net worth contributed (money + items donated, minus personal
// items taken). Used by both the dashboard preview widget and the full
// /leaderboard page so they always match.
export async function getTopContributors(limit = 25) {
  const ledger = await getContributionLedger();
  return Array.from(ledger.values())
    .filter((e) => e.totalWorthContributed > 0 || e.itemsTakenValue > 0)
    .sort((a, b) => b.netContributed - a.netContributed)
    .slice(0, limit);
}
