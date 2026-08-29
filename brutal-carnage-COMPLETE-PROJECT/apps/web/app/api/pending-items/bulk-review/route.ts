// app/api/pending-items/bulk-review/route.ts
// Approve or reject many pending items at once (checkbox multi-select or
// "Approve all"). Reuses the exact same per-item logic as the single-item
// review route so stock crediting / logging / notifications stay identical.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { bulkReviewPendingItemsSchema } from "@/lib/validators/inventory";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canApprovePendingItems")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bulkReviewPendingItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, approve } = parsed.data;

  const pendingItems = await prisma.pendingItem.findMany({
    where: { id: { in: ids }, status: "PENDING" },
  });

  const results: { id: string; ok: boolean }[] = [];

  for (const pendingItem of pendingItems) {
    try {
      if (!approve) {
        await prisma.pendingItem.update({
          where: { id: pendingItem.id },
          data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
        });
        results.push({ id: pendingItem.id, ok: true });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.pendingItem.update({
          where: { id: pendingItem.id },
          data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
        });

        const item = await tx.item.upsert({
          where: { name: pendingItem.name },
          update: { currentStock: { increment: pendingItem.quantity } },
          create: {
            name: pendingItem.name,
            suggestedPrice: pendingItem.suggestedPrice,
            currentStock: pendingItem.quantity,
          },
        });

        await tx.itemAction.create({
          data: {
            itemId: item.id,
            userId: pendingItem.submittedById,
            type: "DONATE",
            quantity: pendingItem.quantity,
            status: "APPROVED",
            note: "Auto-logged from approved new-item submission (bulk review)",
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
      });

      results.push({ id: pendingItem.id, ok: true });
    } catch (err) {
      console.error(`[bulk-review] failed for pending item ${pendingItem.id}`, err);
      results.push({ id: pendingItem.id, ok: false });
    }
  }

  return NextResponse.json({
    success: true,
    reviewed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
