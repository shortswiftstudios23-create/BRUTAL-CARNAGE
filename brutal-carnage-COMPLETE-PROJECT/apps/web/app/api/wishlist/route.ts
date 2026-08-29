// app/api/wishlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({ itemId: z.string().cuid(), quantity: z.number().int().positive().default(1) });
const removeSchema = z.object({ itemId: z.string().cuid() });

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wishlist = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: { item: { select: { id: true, name: true, suggestedPrice: true, currentStock: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ wishlist });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const wishlistItem = await prisma.wishlistItem.upsert({
    where: { userId_itemId: { userId: session.user.id, itemId: parsed.data.itemId } },
    update: { quantity: parsed.data.quantity },
    create: { userId: session.user.id, itemId: parsed.data.itemId, quantity: parsed.data.quantity },
  });

  return NextResponse.json({ wishlistItem }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.wishlistItem.deleteMany({
    where: { userId: session.user.id, itemId: parsed.data.itemId },
  });

  return NextResponse.json({ success: true });
}
