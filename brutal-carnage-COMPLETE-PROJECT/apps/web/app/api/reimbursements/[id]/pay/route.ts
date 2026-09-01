// app/api/reimbursements/[id]/pay/route.ts
// Pays back a member who fronted a family expense personally and asked
// to be reimbursed rather than have it count as a donation. Deducts the
// family balance like any other withdrawal and marks the IOU settled.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { applyBalanceDelta } from "@/lib/balance";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApproveBankRequests")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reimbursement = await prisma.reimbursement.findUnique({ where: { id: params.id } });
  if (!reimbursement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (reimbursement.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await applyBalanceDelta(tx, -Number(reimbursement.amount), "REIMBURSEMENT_PAID", reimbursement.id);
    await tx.reimbursement.update({
      where: { id: reimbursement.id },
      data: { status: "PAID", paidAt: new Date(), paidById: session.user.id },
    });
    await tx.notification.create({
      data: {
        userId: reimbursement.userId,
        type: "BANK",
        title: "Reimbursement paid",
        body: `You were paid back $${Number(reimbursement.amount).toLocaleString()} for "${reimbursement.reason}".`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
