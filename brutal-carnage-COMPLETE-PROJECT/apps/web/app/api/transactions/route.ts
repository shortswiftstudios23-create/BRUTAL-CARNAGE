// app/api/transactions/route.ts
// Creates a PENDING transaction with the full tax breakdown already
// computed and stored (originalAmount / taxAmount / finalAmount), so
// the UI can always show "you donated $1,000 → $30 tax → $970 credited"
// without recalculating anything client-side. Approval (separate route)
// is what actually moves the FamilyBalance.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTransactionSchema } from "@/lib/validators/money";
import { calculateTax } from "@/lib/tax";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, amount, note, soldItemId, soldQuantity } = parsed.data;
  const breakdown = calculateTax(amount, type);

  // For sold-items sales, sanity-check there's enough stock to sell before
  // even creating the pending record — the actual decrement still only
  // happens on approval, but this catches an obvious mistake early.
  if (type === "SOLD_ITEMS" && soldItemId && soldQuantity) {
    const item = await prisma.item.findUnique({ where: { id: soldItemId } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (item.currentStock < soldQuantity) {
      return NextResponse.json(
        { error: `Only ${item.currentStock} in stock — can't sell ${soldQuantity}.` },
        { status: 400 }
      );
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      type,
      category: type,
      originalAmount: breakdown.originalAmount,
      taxAmount: breakdown.taxAmount,
      finalAmount: breakdown.finalAmount,
      note,
      userId: session.user.id,
      status: "PENDING",
      soldItemId: type === "SOLD_ITEMS" ? soldItemId : undefined,
      soldQuantity: type === "SOLD_ITEMS" ? soldQuantity : undefined,
    },
  });

  return NextResponse.json({ transaction, breakdown });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  const transactions = await prisma.transaction.findMany({
    where: mine ? { userId: session.user.id } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { username: true, rank: true } } },
  });

  return NextResponse.json({ transactions });
}
