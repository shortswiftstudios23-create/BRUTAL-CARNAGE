// app/api/dashboard/balance-history/route.ts
// Real balance history for the dashboard chart, replacing what used to
// be hardcoded mock data. Reads from BalanceSnapshot, which every
// balance-mutating route writes to via lib/balance.ts's
// applyBalanceDelta — so this is an accurate ledger, not an estimate.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 1), 365);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [snapshots, currentBalance] = await Promise.all([
    prisma.balanceSnapshot.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
  ]);

  // If there's no snapshot at all yet inside the window (e.g. balance
  // hasn't moved in `days`), still return one point at the current
  // balance so the chart isn't empty.
  if (snapshots.length === 0) {
    return NextResponse.json({
      history: [
        {
          date: since.toISOString(),
          balance: Number(currentBalance?.balance ?? 0),
        },
      ],
    });
  }

  const history = snapshots.map((s) => ({
    date: s.createdAt.toISOString(),
    balance: Number(s.balance),
  }));

  return NextResponse.json({ history });
}
