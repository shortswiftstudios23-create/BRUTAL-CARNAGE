// app/(dashboard)/inventory/wishlist/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WishlistClient } from "./wishlist-client";

export default async function WishlistPage() {
  const session = await auth();

  const [wishlist, items, unreadCount] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId: session!.user.id },
      include: { item: { select: { id: true, name: true, suggestedPrice: true, currentStock: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.item.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Item wishlist" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <Link href="/inventory" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
        <p className="mb-6 text-sm text-zinc-500">
          Request items you think the family should buy. This is a wishlist, not an order — it doesn't create a pending approval.
        </p>
        <WishlistClient
          wishlist={wishlist.map((w) => ({
            id: w.id,
            itemId: w.itemId,
            name: w.item.name,
            suggestedPrice: Number(w.item.suggestedPrice),
            currentStock: w.item.currentStock,
            quantity: w.quantity,
          }))}
          items={items}
        />
      </main>
    </>
  );
}
