// app/api/marketplace/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createResaleListingSchema } from "@/lib/validators/marketplace";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.resaleListing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { id: true, username: true, discordId: true, rank: true } },
      linkedItem: { select: { id: true, name: true, currentStock: true } },
    },
  });

  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createResaleListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Only Deputy/Boss/Big Boss can post a listing as family stock — anyone
  // can still list their own personal items regardless of rank.
  if (parsed.data.isFamilyStock && !can(session.user.rank, "canListFamilyStockForSale")) {
    return NextResponse.json({ error: "Forbidden: only Deputy+ can list family inventory for sale" }, { status: 403 });
  }

  // If listing family stock linked to a real catalog item, make sure it
  // exists and there's enough stock to cover the listed quantity.
  if (parsed.data.isFamilyStock && parsed.data.linkedItemId) {
    const item = await prisma.item.findUnique({ where: { id: parsed.data.linkedItemId } });
    if (!item) return NextResponse.json({ error: "Linked item not found" }, { status: 404 });
    if (item.currentStock < parsed.data.quantity) {
      return NextResponse.json({ error: "Not enough stock for that quantity" }, { status: 400 });
    }
  }

  const listing = await prisma.resaleListing.create({
    data: {
      itemName: parsed.data.itemName,
      description: parsed.data.description,
      askingPrice: parsed.data.askingPrice,
      quantity: parsed.data.quantity,
      isFamilyStock: parsed.data.isFamilyStock,
      linkedItemId: parsed.data.linkedItemId,
      sellerId: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RESALE_LISTING_CREATED",
      metadata: { listingId: listing.id, isFamilyStock: listing.isFamilyStock },
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
