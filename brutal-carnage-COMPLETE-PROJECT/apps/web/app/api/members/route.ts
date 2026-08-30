// app/api/members/route.ts
// Powers the /members directory: search by username, filter by rank
// and blacklist status. Kept as one flexible GET rather than separate
// endpoints per filter, since the page needs to combine them freely.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Rank } from "@prisma/client";
import { getContributionLedger } from "@/lib/contributions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const rank = searchParams.get("rank") as Rank | null;
  const blacklistedParam = searchParams.get("blacklisted");
  const canViewFinancials = can(session.user.rank, "canViewMemberPerformanceDetail");

  const members = await prisma.user.findMany({
    where: {
      username: q ? { contains: q, mode: "insensitive" } : undefined,
      rank: rank ?? undefined,
      isBlacklisted:
        blacklistedParam === "true" ? true : blacklistedParam === "false" ? false : undefined,
    },
    select: {
      id: true,
      username: true,
      discordAvatar: true,
      rank: true,
      isBlacklisted: true,
      blacklistReason: true,
      lastActiveAt: true,
      joinedFamilyAt: true,
    },
    orderBy: { username: "asc" },
    take: 200,
  });

  if (!canViewFinancials) {
    return NextResponse.json({ members });
  }

  const [ledger, activeLoans] = await Promise.all([
    getContributionLedger(members.map((m) => m.id)),
    prisma.loan.findMany({
      where: { userId: { in: members.map((m) => m.id) }, status: { in: ["PENDING", "ACTIVE"] } },
      select: { userId: true, status: true, amountOwed: true, dueAt: true },
    }),
  ]);
  const loanByUser = new Map(activeLoans.map((l) => [l.userId, l]));

  return NextResponse.json({
    members: members.map((m) => {
      const entry = ledger.get(m.id);
      const loan = loanByUser.get(m.id);
      return {
        ...m,
        moneyDonated: entry?.moneyDonated ?? 0,
        itemsDonatedValue: entry?.itemsDonatedValue ?? 0,
        itemsTakenValue: entry?.itemsTakenValue ?? 0,
        moneyWithdrawn: entry?.moneyWithdrawn ?? 0,
        loanStatus: loan
          ? { status: loan.status, amountOwed: Number(loan.amountOwed), dueAt: loan.dueAt?.toISOString() ?? null }
          : null,
      };
    }),
  });
}
