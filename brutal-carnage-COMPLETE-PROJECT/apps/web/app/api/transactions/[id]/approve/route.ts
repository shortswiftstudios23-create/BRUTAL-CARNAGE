// app/api/transactions/[id]/approve/route.ts
// This is the ONLY place FamilyBalance.balance ever changes for a
// donation/withdrawal/etc — approval is the single point where money
// actually moves, keeping the ledger honest and auditable.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { applyBalanceDelta } from "@/lib/balance";

// Income categories add to the family balance; expense categories subtract.
const INCOME_TYPES = ["DONATION", "FAMILY_BONUS", "FAMILY_RAID", "SOLD_ITEMS", "OTHER_INCOME"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApproveTransactions")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transaction = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  if (transaction.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const isIncome = INCOME_TYPES.includes(transaction.type);
  const delta = isIncome ? Number(transaction.finalAmount) : -Number(transaction.finalAmount);

  // Re-check stock at approval time too, in case it changed between
  // submission and approval (e.g. someone else sold/donated the same item).
  if (transaction.type === "SOLD_ITEMS" && transaction.soldItemId && transaction.soldQuantity) {
    const item = await prisma.item.findUnique({ where: { id: transaction.soldItemId } });
    if (!item || item.currentStock < transaction.soldQuantity) {
      return NextResponse.json(
        { error: "Not enough stock remains to approve this sale." },
        { status: 409 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    if (transaction.type === "SOLD_ITEMS" && transaction.soldItemId && transaction.soldQuantity) {
      await tx.item.update({
        where: { id: transaction.soldItemId },
        data: { currentStock: { decrement: transaction.soldQuantity } },
      });
    }

    await applyBalanceDelta(tx, delta, "TRANSACTION_APPROVED", transaction.id);

    await tx.notification.create({
      data: {
        userId: transaction.userId,
        type: "BANK",
        title: isIncome ? "Contribution approved" : "Withdrawal approved",
        body: `Your ${transaction.type.toLowerCase().replace(/_/g, " ")} of $${Number(
          transaction.finalAmount
        ).toLocaleString()} has been approved.`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TRANSACTION_APPROVED",
        metadata: { transactionId: transaction.id, delta },
      },
    });
  });

  return NextResponse.json({ success: true });
}
