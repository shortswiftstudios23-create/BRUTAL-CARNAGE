// lib/performance.ts
// All the "automatic" scoring logic lives here in one place: badge
// thresholds and the inactivity rule. The recompute API route calls this
// on a schedule (or on-demand); pages just read whatever it last wrote.

import { prisma } from "./prisma";

export const INACTIVE_DAYS_THRESHOLD = 14;

export const BADGE_DEFINITIONS = {
  TOP_DONOR: {
    name: "Top Donor",
    description: "Among the top 3 contributors by total donations this month.",
  },
  EVENT_BEAST: {
    name: "Event Beast",
    description: "Attended 5+ events in the last 30 days.",
  },
  RELIABLE: {
    name: "Reliable",
    description: "Registered for events and actually showed up 90%+ of the time (min. 3 events).",
  },
  MOST_IMPROVED: {
    name: "Most Improved",
    description: "Contribution activity roughly doubled compared to the prior 30-day window.",
  },
} as const;

type BadgeKey = keyof typeof BADGE_DEFINITIONS;

async function ensureBadgesExist() {
  for (const key of Object.keys(BADGE_DEFINITIONS) as BadgeKey[]) {
    const def = BADGE_DEFINITIONS[key];
    await prisma.badge.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: { name: def.name, description: def.description },
    });
  }
}

// Recomputes every automatic badge for every non-blacklisted member and
// flips lastActiveAt-based inactivity. Cheap enough to run nightly via
// the bot's cron or an on-demand admin button — it's all read-heavy
// aggregate queries, no writes except the badge awards themselves.
export async function recomputePerformance() {
  await ensureBadgesExist();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const badges = await prisma.badge.findMany({ where: { name: { in: Object.values(BADGE_DEFINITIONS).map((b) => b.name) } } });
  const badgeIdByName = Object.fromEntries(badges.map((b) => [b.name, b.id]));

  const members = await prisma.user.findMany({ where: { isBlacklisted: false } });

  // --- Top Donor (top 3 by approved DONATION this month) ---
  const donationsThisMonth = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { type: "DONATION", status: "APPROVED", createdAt: { gte: monthStart } },
    _sum: { finalAmount: true },
    orderBy: { _sum: { finalAmount: "desc" } },
    take: 3,
  });
  const topDonorIds = new Set(donationsThisMonth.map((d) => d.userId));

  for (const member of members) {
    // --- Event Beast: 5+ attended events in last 30 days ---
    const recentAttended = await prisma.eventRegistration.count({
      where: { userId: member.id, attended: true, event: { startsAt: { gte: thirtyDaysAgo } } },
    });

    // --- Reliable: 90%+ show-up rate, min 3 registrations ---
    const totalRegistrations = await prisma.eventRegistration.count({
      where: { userId: member.id, event: { startsAt: { lte: now } } },
    });
    const attendedCount = await prisma.eventRegistration.count({
      where: { userId: member.id, attended: true, event: { startsAt: { lte: now } } },
    });
    const showUpRate = totalRegistrations > 0 ? attendedCount / totalRegistrations : 0;

    // --- Most Improved: contribution count roughly doubled vs prior window ---
    const [recentContribs, priorContribs] = await Promise.all([
      prisma.transaction.count({ where: { userId: member.id, status: "APPROVED", createdAt: { gte: thirtyDaysAgo } } }),
      prisma.transaction.count({
        where: { userId: member.id, status: "APPROVED", createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
    ]);
    const isMostImproved = priorContribs >= 1 && recentContribs >= priorContribs * 2 && recentContribs >= 3;

    const earned: BadgeKey[] = [];
    if (topDonorIds.has(member.id)) earned.push("TOP_DONOR");
    if (recentAttended >= 5) earned.push("EVENT_BEAST");
    if (totalRegistrations >= 3 && showUpRate >= 0.9) earned.push("RELIABLE");
    if (isMostImproved) earned.push("MOST_IMPROVED");

    for (const key of earned) {
      const badgeId = badgeIdByName[BADGE_DEFINITIONS[key].name];
      if (!badgeId) continue;
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: member.id, badgeId } },
        update: {},
        create: { userId: member.id, badgeId },
      });
    }
  }

  return { membersScored: members.length, topDonorIds: Array.from(topDonorIds) };
}

// Full itemized history for the Boss+ per-member drill-down: every
// donation/withdrawal with its date, and every event the member ever
// registered for with whether they actually showed up. Unlike
// getMemberStats (which just returns totals), this returns row-level
// detail so an admin can see exactly what someone gave/took and when.
export async function getMemberDetailedHistory(userId: string) {
  const [donations, withdrawals, itemActions, eventHistory] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: "DONATION", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, finalAmount: true, note: true, createdAt: true, occurredAt: true },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "WITHDRAWAL", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, finalAmount: true, note: true, createdAt: true, occurredAt: true },
    }),
    prisma.itemAction.findMany({
      where: { userId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: { item: { select: { name: true } } },
    }),
    prisma.eventRegistration.findMany({
      where: { userId },
      orderBy: { registeredAt: "desc" },
      include: { event: { select: { id: true, title: true, startsAt: true, result: true, status: true } } },
    }),
  ]);

  return {
    donations: donations.map((d) => ({
      id: d.id,
      amount: Number(d.finalAmount),
      note: d.note,
      date: d.occurredAt ?? d.createdAt,
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.finalAmount),
      note: w.note,
      date: w.occurredAt ?? w.createdAt,
    })),
    itemActions: itemActions.map((a) => ({
      id: a.id,
      type: a.type,
      itemName: a.item.name,
      quantity: a.quantity,
      date: a.occurredAt ?? a.createdAt,
    })),
    events: eventHistory.map((r) => ({
      eventId: r.event.id,
      title: r.event.title,
      startsAt: r.event.startsAt,
      result: r.event.result,
      registered: true,
      attended: r.attended,
    })),
  };
}

export function isInactive(lastActiveAt: Date): boolean {
  const daysSince = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= INACTIVE_DAYS_THRESHOLD;
}

// Raw stats block used both by the performance page and fed into the
// AI summary prompt so the model is grounded in real numbers, not
// hallucinating a member's history.
export async function getMemberStats(userId: string) {
  const [donations, eventsAttended, eventsRegistered, itemActions, strikes, badges] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: "DONATION", status: "APPROVED" },
      _sum: { finalAmount: true },
      _count: true,
    }),
    prisma.eventRegistration.count({ where: { userId, attended: true } }),
    prisma.eventRegistration.count({ where: { userId } }),
    prisma.itemAction.count({ where: { userId, status: "APPROVED" } }),
    prisma.strike.count({ where: { userId } }),
    prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }),
  ]);

  return {
    totalDonated: Number(donations._sum.finalAmount ?? 0),
    donationCount: donations._count,
    eventsAttended,
    eventsRegistered,
    showUpRate: eventsRegistered > 0 ? eventsAttended / eventsRegistered : null,
    itemActionsCompleted: itemActions,
    strikeCount: strikes,
    badges: badges.map((b) => b.badge.name),
  };
}
