// app/api/inventory/items/[id]/route.ts
// Deputy+ correcting the catalog: rename an item or fix its price. Does
// NOT touch currentStock or any historical ItemAction rows — this is a
// catalog metadata fix, not a stock adjustment.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateItemSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  suggestedPrice: z.coerce.number().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canEditItemCatalog")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.name && parsed.data.suggestedPrice === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (parsed.data.name) {
    const clash = await prisma.item.findFirst({
      where: { name: parsed.data.name, id: { not: params.id } },
    });
    if (clash) {
      return NextResponse.json({ error: "An item with that name already exists" }, { status: 409 });
    }
  }

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.suggestedPrice !== undefined ? { suggestedPrice: parsed.data.suggestedPrice } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ITEM_CATALOG_EDITED",
      metadata: { itemId: item.id, name: item.name, suggestedPrice: Number(item.suggestedPrice) },
    },
  });

  return NextResponse.json({
    item: { id: item.id, name: item.name, suggestedPrice: Number(item.suggestedPrice) },
  });
}
