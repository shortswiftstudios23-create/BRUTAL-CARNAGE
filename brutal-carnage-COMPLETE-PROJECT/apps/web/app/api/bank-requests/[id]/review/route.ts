// app/api/bank-requests/[id]/review/route.ts
// Approval is the only place a BankRequest actually moves money out of
// FamilyBalance — mirrors how transactions/[id]/approve/route.ts works,
// so the ledger has a single, auditable point of truth either way.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reviewBankRequestSchema } from "@/lib/validators/money";
import { applyBalanceDelta } from "@/lib/balance";
import { getPersonalExpenseAllowance } from "@/lib/personalExpense";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApproveBankRequests")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reviewBankRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bankRequest = await prisma.bankRequest.findUnique({ where: { id: params.id } });
  if (!bankRequest) {
    return NextResponse.json({ error: "Bank request not found" }, { status: 404 });
  }
  if (bankRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  if (!parsed.data.approve) {
    await prisma.bankRequest.update({
      where: { id: bankRequest.id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionNote: parsed.data.rejectionNote,
      },
    });

    await prisma.notification.create({
      data: {
        userId: bankRequest.userId,
        type: "BANK",
        title: "Bank request declined",
        body: parsed.data.rejectionNote
          ? `Your request for $${Number(bankRequest.amount).toLocaleString()} was declined: ${parsed.data.rejectionNote}`
          : `Your request for $${Number(bankRequest.amount).toLocaleString()} was declined.`,
      },
    });

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  if (bankRequest.category === "PERSONAL_EXPENSE") {
    const { remaining } = await getPersonalExpenseAllowance(bankRequest.userId, bankRequest.id);
    if (Number(bankRequest.amount) > remaining) {
      return NextResponse.json(
        {
          error: `This would exceed the member's 10%-of-donations personal expense limit (only $${remaining.toLocaleString()} left). Their donation total or other requests may have changed since this was submitted.`,
        },
        { status: 409 }
      );
    }
  }

  const balance = await prisma.familyBalance.findUnique({ where: { id: "singleton" } });
  const currentBalance = Number(balance?.balance ?? 0);
  if (currentBalance < Number(bankRequest.amount)) {
    return NextResponse.json(
      { error: `Family balance ($${currentBalance.toLocaleString()}) is lower than the requested amount.` },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.bankRequest.update({
      where: { id: bankRequest.id },
      data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    await applyBalanceDelta(tx, -Number(bankRequest.amount), "BANK_REQUEST_APPROVED", bankRequest.id);

    await tx.notification.create({
      data: {
        userId: bankRequest.userId,
        type: "BANK",
        title: "Bank request approved",
        body: `Your request for $${Number(bankRequest.amount).toLocaleString()} has been approved and paid out.`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BANK_REQUEST_APPROVED",
        metadata: { bankRequestId: bankRequest.id, amount: Number(bankRequest.amount) },
      },
    });
  });

  return NextResponse.json({ success: true, status: "APPROVED" });
}
