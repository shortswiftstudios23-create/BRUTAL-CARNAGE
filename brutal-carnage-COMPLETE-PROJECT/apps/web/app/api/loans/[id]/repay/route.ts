// app/api/loans/[id]/repay/route.ts
// Borrower (or an admin on their behalf) pays money back toward an
// ACTIVE loan. Repayments come straight off amountOwed — no tax applies
// to loan repayments, only to donations/withdrawals (see lib/tax.ts).
// Fully repaying flips status to PAID and stops interest accrual.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { repayLoanSchema } from "@/lib/validators/money";
import { applyBalanceDelta } from "@/lib/balance";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loan = await prisma.loan.findUnique({ where: { id: params.id } });
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const isOwner = loan.userId === session.user.id;
  const isAdmin = can(session.user.rank, "canApproveLoans");
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (loan.status !== "ACTIVE") {
    return NextResponse.json({ error: "This loan isn't active." }, { status: 409 });
  }

  const body = await req.json();
  const parsed = repayLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owed = Number(loan.amountOwed);
  const payment = Math.min(parsed.data.amount, owed); // never let it go negative
  const remaining = Math.round((owed - payment) * 100) / 100;
  const fullyRepaid = remaining <= 0;

  await prisma.$transaction(async (tx) => {
    await tx.loanRepayment.create({
      data: { loanId: loan.id, amount: payment },
    });

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        amountOwed: remaining,
        status: fullyRepaid ? "PAID" : "ACTIVE",
        paidAt: fullyRepaid ? new Date() : undefined,
      },
    });

    await applyBalanceDelta(tx, payment, "LOAN_REPAYMENT", loan.id);

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LOAN_REPAYMENT",
        metadata: { loanId: loan.id, payment, remaining },
      },
    });
  });

  return NextResponse.json({ success: true, remaining, fullyRepaid });
}
