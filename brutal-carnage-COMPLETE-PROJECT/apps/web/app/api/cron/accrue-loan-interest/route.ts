// app/api/cron/accrue-loan-interest/route.ts
// Compounds interest on every ACTIVE loan every 5 days. This route does
// nothing on its own — something has to actually call it on a schedule
// (Render Cron Job, GitHub Actions cron, or an external pinger like
// cron-job.org hitting this URL daily). It's safe to call more often
// than every 5 days: each loan only accrues for whole 5-day periods
// that have actually elapsed since its own lastAccrualAt, and it's
// idempotent if called twice in the same period (no periods are due,
// so nothing happens).
//
// Protected by CRON_SECRET so randoms on the internet can't trigger it.
// Set CRON_SECRET in your .env and pass it as a Bearer token or
// ?secret= query param from whatever scheduler you use.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ACCRUAL_PERIOD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    new URL(req.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
  });

  const now = Date.now();
  let accruedCount = 0;

  for (const loan of activeLoans) {
    const lastAccrual = loan.lastAccrualAt?.getTime() ?? loan.createdAt.getTime();
    const periodsElapsed = Math.floor((now - lastAccrual) / ACCRUAL_PERIOD_MS);
    if (periodsElapsed < 1) continue;

    let owed = Number(loan.amountOwed);
    const rate = Number(loan.interestRate);
    // Compound once per elapsed 5-day period, not one lump interest
    // charge for the whole gap — matters if the cron missed a run.
    for (let i = 0; i < periodsElapsed; i++) {
      owed = Math.round(owed * (1 + rate) * 100) / 100;
    }

    const newLastAccrualAt = new Date(lastAccrual + periodsElapsed * ACCRUAL_PERIOD_MS);

    await prisma.loan.update({
      where: { id: loan.id },
      data: { amountOwed: owed, lastAccrualAt: newLastAccrualAt },
    });

    await prisma.notification.create({
      data: {
        userId: loan.userId,
        type: "BANK",
        title: "Loan interest applied",
        body: `Interest was added to your loan. You now owe $${owed.toLocaleString()}.`,
      },
    });

    accruedCount++;
  }

  return NextResponse.json({ success: true, loansChecked: activeLoans.length, loansAccrued: accruedCount });
}
