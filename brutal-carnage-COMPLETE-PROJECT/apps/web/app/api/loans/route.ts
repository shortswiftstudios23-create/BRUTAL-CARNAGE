// app/api/loans/route.ts
// Members request a loan FROM the family balance at 12% interest.
// Interest compounds every 5 days once the loan is APPROVED (see
// /api/cron/accrue-loan-interest and [id]/review/route.ts). Mirrors the
// bank-requests pattern: a loan doesn't touch FamilyBalance until approved.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createLoanSchema } from "@/lib/validators/money";

const DEFAULT_INTEREST_RATE = 0.12;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One active/pending loan at a time — prevents stacking debt before
  // an existing one is even reviewed or repaid.
  const existing = await prisma.loan.findFirst({
    where: { userId: session.user.id, status: { in: ["PENDING", "ACTIVE"] } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending or active loan. Repay or wait for it to be reviewed first." },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = createLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const loan = await prisma.loan.create({
    data: {
      principal: parsed.data.amount,
      amountOwed: parsed.data.amount,
      interestRate: DEFAULT_INTEREST_RATE,
      reason: parsed.data.reason,
      durationDays: parsed.data.durationDays,
      collateralItems: parsed.data.collateralItems,
      collateralValue: parsed.data.collateralValue,
      userId: session.user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ loan }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const pendingOnly = searchParams.get("status") === "PENDING";

  const canSeeAll = can(session.user.rank, "canApproveLoans");

  const loans = await prisma.loan.findMany({
    where: {
      userId: mine || !canSeeAll ? session.user.id : undefined,
      status: pendingOnly ? "PENDING" : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { username: true, rank: true } } },
  });

  return NextResponse.json({ loans });
}
