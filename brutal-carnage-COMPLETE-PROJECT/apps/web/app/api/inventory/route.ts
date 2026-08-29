// app/api/inventory/route.ts
// Handles a single multi-select submission that can mix:
//  - existing catalog items (goes straight to ItemAction, PENDING approval)
//  - brand-new items the member typed in (goes to PendingItem approval;
//    only becomes a real Item + stock credit once an admin approves it)
//
// Both branches run in one transaction so a submission is all-or-nothing.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitInventoryActionSchema } from "@/lib/validators/inventory";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = submitInventoryActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, existingItems, newItems, note } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const createdActions = await Promise.all(
      existingItems.map((entry) =>
        tx.itemAction.create({
          data: {
            itemId: entry.itemId,
            userId: session.user.id,
            type,
            quantity: entry.quantity,
            note,
            status: "PENDING",
          },
        })
      )
    );

    const createdPendingItems = await Promise.all(
      newItems.map((entry) =>
        tx.pendingItem.create({
          data: {
            name: entry.name,
            suggestedPrice: entry.suggestedPrice,
            quantity: entry.quantity,
            reason: note,
            submittedById: session.user.id,
            status: "PENDING",
          },
        })
      )
    );

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INVENTORY_SUBMISSION_CREATED",
        metadata: {
          type,
          existingItemCount: existingItems.length,
          newItemCount: newItems.length,
        },
      },
    });

    return { createdActions, createdPendingItems };
  });

  return NextResponse.json({
    success: true,
    itemActionsCreated: result.createdActions.length,
    pendingItemsCreated: result.createdPendingItems.length,
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.item.findMany({
    orderBy: { name: "asc" },
    include: {
      favoritedBy: { where: { userId: session.user.id }, select: { id: true } },
    },
  });

  const totalWorth = items.reduce(
    (sum, item) => sum + Number(item.suggestedPrice) * item.currentStock,
    0
  );

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      isFavorited: item.favoritedBy.length > 0,
    })),
    totalWorth,
  });
}
