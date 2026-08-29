// app/(dashboard)/marketplace/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { MarketplaceClient } from "./marketplace-client";

export default async function MarketplacePage() {
  const session = await auth();

  const [listings, unreadCount, familyItems] = await Promise.all([
    prisma.resaleListing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { id: true, username: true, discordId: true, rank: true } },
        linkedItem: { select: { id: true, name: true, currentStock: true } },
      },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
    prisma.item.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, currentStock: true } }),
  ]);

  const canListFamilyStock = can(session!.user.rank, "canListFamilyStockForSale");

  return (
    <>
      <Topbar pageTitle="Marketplace" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <MarketplaceClient
          currentUserId={session!.user.id}
          canListFamilyStock={canListFamilyStock}
          familyItems={familyItems.map((i) => ({ ...i }))}
          listings={listings.map((l) => ({
            id: l.id,
            itemName: l.itemName,
            description: l.description,
            askingPrice: Number(l.askingPrice),
            quantity: l.quantity,
            isFamilyStock: l.isFamilyStock,
            createdAt: l.createdAt.toISOString(),
            seller: {
              id: l.seller.id,
              username: l.seller.username,
              discordId: l.seller.discordId,
              rank: l.seller.rank,
            },
            linkedItem: l.linkedItem ? { id: l.linkedItem.id, name: l.linkedItem.name, currentStock: l.linkedItem.currentStock } : null,
          }))}
        />
      </main>
    </>
  );
}
