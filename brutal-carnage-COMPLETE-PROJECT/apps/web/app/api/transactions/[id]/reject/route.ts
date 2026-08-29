// app/api/transactions/[id]/reject/route.ts
// Mirrors approve/route.ts but never touches FamilyBalance — a rejected
// transaction simply never happened financially.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

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

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    await tx.notification.create({
      data: {
        userId: transaction.userId,
        type: "BANK",
        title: "Transaction rejected",
        body: `Your ${transaction.type.toLowerCase().replace(/_/g, " ")} of $${Number(
          transaction.finalAmount
        ).toLocaleString()} was rejected.`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TRANSACTION_REJECTED",
        metadata: { transactionId: transaction.id },
      },
    });
  });

  return NextResponse.json({ success: true });
}
