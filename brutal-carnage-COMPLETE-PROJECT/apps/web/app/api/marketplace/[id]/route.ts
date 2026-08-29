// app/api/marketplace/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { updateResaleListingStatusSchema } from "@/lib/validators/marketplace";

// Marks a listing SOLD or CANCELLED. Only the seller themselves, or
// Deputy+, can do this (so leadership can clean up stale/abusive
// listings without waiting on the original poster).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.resaleListing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const isOwner = listing.sellerId === session.user.id;
  const isLeadership = can(session.user.rank, "canListFamilyStockForSale");
  if (!isOwner && !isLeadership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateResaleListingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.resaleListing.update({
      where: { id: listing.id },
      data: {
        status: parsed.data.status,
        soldAt: parsed.data.status === "SOLD" ? new Date() : undefined,
      },
    });

    // If a family-stock listing linked to a real item sold, decrement
    // stock accordingly so inventory stays accurate.
    if (parsed.data.status === "SOLD" && listing.isFamilyStock && listing.linkedItemId) {
      await tx.item.update({
        where: { id: listing.linkedItemId },
        data: { currentStock: { decrement: listing.quantity } },
      });
    }

    return result;
  });

  return NextResponse.json({ listing: updated });
}
