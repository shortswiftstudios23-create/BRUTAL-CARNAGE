// app/(dashboard)/inventory/all/page.tsx
// Full catalog view — the main /inventory page only ever showed a
// 12-item "snapshot", with no way to see everything in stock. This is
// the "a place where we can see all the items there are in our
// inventory" page from the request.

import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AllInventoryClient } from "./all-inventory-client";

export default async function AllInventoryPage() {
  const session = await auth();
  const [items, unreadCount] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  const formattedItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    suggestedPrice: Number(i.suggestedPrice),
    currentStock: i.currentStock,
    category: i.category,
  }));

  return (
    <>
      <Topbar pageTitle="All inventory items" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/inventory" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
        <AllInventoryClient items={formattedItems} canViewWorth={can(session!.user.rank, "canViewInventoryWorth")} />
      </main>
    </>
  );
}
