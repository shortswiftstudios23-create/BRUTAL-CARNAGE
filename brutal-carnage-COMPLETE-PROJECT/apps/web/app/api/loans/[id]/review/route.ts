// app/api/loans/[id]/review/route.ts
// Approving a loan is the only place it moves money OUT of FamilyBalance
// and starts the loan compounding. Rejecting just closes it out — no
// money ever moved, so there's nothing to reverse.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reviewLoanSchema } from "@/lib/validators/money";
import { applyBalanceDelta } from "@/lib/balance";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApproveLoans")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reviewLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const loan = await prisma.loan.findUnique({ where: { id: params.id } });
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }
  if (loan.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  if (!parsed.data.approve) {
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionNote: parsed.data.rejectionNote,
      },
    });

    await prisma.notification.create({
      data: {
        userId: loan.userId,
        type: "BANK",
        title: "Loan request declined",
        body: parsed.data.rejectionNote
          ? `Your loan request for $${Number(loan.principal).toLocaleString()} was declined: ${parsed.data.rejectionNote}`
          : `Your loan request for $${Number(loan.principal).toLocaleString()} was declined.`,
      },
    });

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  const balance = await prisma.familyBalance.findUnique({ where: { id: "singleton" } });
  const currentBalance = Number(balance?.balance ?? 0);
  if (currentBalance < Number(loan.principal)) {
    return NextResponse.json(
      { error: `Family balance ($${currentBalance.toLocaleString()}) is lower than the requested loan.` },
      { status: 409 }
    );
  }

  const DEFAULT_DUE_DAYS = 14;
  const dueInDays = parsed.data.dueInDays ?? DEFAULT_DUE_DAYS;
  const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        status: "ACTIVE",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        lastAccrualAt: new Date(), // interest starts compounding from now
        dueAt,
      },
    });

    await applyBalanceDelta(tx, -Number(loan.principal), "LOAN_DISBURSED", loan.id);

    await tx.notification.create({
      data: {
        userId: loan.userId,
        type: "BANK",
        title: "Loan approved",
        body: `Your loan of $${Number(loan.principal).toLocaleString()} was approved and paid out, due ${dueAt.toLocaleDateString()}. Interest (12%) compounds every 5 days until repaid.`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LOAN_APPROVED",
        metadata: { loanId: loan.id, principal: Number(loan.principal) },
      },
    });
  });

  return NextResponse.json({ success: true, status: "ACTIVE" });
}
