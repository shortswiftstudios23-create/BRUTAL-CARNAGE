// app/api/pending-items/[id]/review/route.ts
// Approving a pending item does three things atomically:
//   1. Marks the PendingItem APPROVED
//   2. Creates (or finds, if it now matches an existing name) the real
//      Item catalog entry
//   3. Credits the requested quantity to stock immediately and writes
//      an ItemAction log entry (already APPROVED) so it shows in the
//      submitter's history and the audit trail — this is the "log" the
//      spec calls for on approval.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { approvePendingItemSchema } from "@/lib/validators/inventory";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApprovePendingItems")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = approvePendingItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pendingItem = await prisma.pendingItem.findUnique({ where: { id: params.id } });
  if (!pendingItem) {
    return NextResponse.json({ error: "Pending item not found" }, { status: 404 });
  }
  if (pendingItem.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  if (!parsed.data.approve) {
    await prisma.pendingItem.update({
      where: { id: pendingItem.id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionNote: parsed.data.rejectionNote,
      },
    });
    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.pendingItem.update({
      where: { id: pendingItem.id },
      data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    // Reuse an existing item by exact name if one appeared since submission,
    // otherwise create it fresh.
    const item = await tx.item.upsert({
      where: { name: pendingItem.name },
      update: { currentStock: { increment: pendingItem.quantity } },
      create: {
        name: pendingItem.name,
        suggestedPrice: pendingItem.suggestedPrice,
        currentStock: pendingItem.quantity,
      },
    });

    const action = await tx.itemAction.create({
      data: {
        itemId: item.id,
        userId: pendingItem.submittedById,
        type: "DONATE",
        quantity: pendingItem.quantity,
        status: "APPROVED",
        note: "Auto-logged from approved new-item submission",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: pendingItem.submittedById,
        type: "APPROVAL",
        title: "New item approved",
        body: `"${pendingItem.name}" was approved and ${pendingItem.quantity} unit(s) were added to stock.`,
      },
    });

    return { item, action };
  });

  return NextResponse.json({ success: true, status: "APPROVED", item: result.item });
}
