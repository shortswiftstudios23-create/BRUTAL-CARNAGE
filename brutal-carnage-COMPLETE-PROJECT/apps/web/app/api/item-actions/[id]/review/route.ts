// app/api/item-actions/[id]/review/route.ts
// Approves or rejects an ItemAction (DONATE / TAKE / ORDER against an
// EXISTING catalog item). Note this is a different pipeline from
// PendingItem (brand-new items not yet in the catalog, reviewed at
// /api/pending-items/[id]/review) — that route already existed, this
// one for existing-item actions did not, which is why submissions here
// had no way to ever be approved or rejected.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { z } from "zod";

const reviewSchema = z.object({
  approve: z.boolean(),
  rejectionNote: z.string().max(300).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApproveItemActions")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const action = await prisma.itemAction.findUnique({ where: { id: params.id }, include: { item: true } });
  if (!action) {
    return NextResponse.json({ error: "Item action not found" }, { status: 404 });
  }
  if (action.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  if (!parsed.data.approve) {
    await prisma.itemAction.update({
      where: { id: action.id },
      data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: action.userId,
        type: "APPROVAL",
        title: "Item action rejected",
        body: `Your ${action.type.toLowerCase()} of ${action.quantity}× ${action.item.name} was rejected.${
          parsed.data.rejectionNote ? ` Reason: ${parsed.data.rejectionNote}` : ""
        }`,
      },
    });

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  // DONATE and ORDER both add stock (a member giving items to the family,
  // or an approved restock order landing); TAKE removes stock. Re-check
  // stock at approval time for TAKE so it can't go negative if several
  // TAKE requests were approved out of order.
  if (action.type === "TAKE" && action.item.currentStock < action.quantity) {
    return NextResponse.json(
      { error: "Not enough stock remains to approve this." },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.itemAction.update({
      where: { id: action.id },
      data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    await tx.item.update({
      where: { id: action.itemId },
      data: {
        currentStock:
          action.type === "TAKE"
            ? { decrement: action.quantity }
            : { increment: action.quantity },
      },
    });

    await tx.notification.create({
      data: {
        userId: action.userId,
        type: "APPROVAL",
        title: "Item action approved",
        body: `Your ${action.type.toLowerCase()} of ${action.quantity}× ${action.item.name} was approved.`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ITEM_ACTION_APPROVED",
        metadata: { itemActionId: action.id, type: action.type, quantity: action.quantity },
      },
    });
  });

  return NextResponse.json({ success: true, status: "APPROVED" });
}
