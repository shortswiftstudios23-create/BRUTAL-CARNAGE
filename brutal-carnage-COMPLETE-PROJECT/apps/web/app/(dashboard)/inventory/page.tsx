// app/(dashboard)/inventory/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { InventoryActionForm } from "@/components/inventory/inventory-action-form";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Package, DollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { can } from "@/lib/permissions";

export default async function InventoryPage() {
  const session = await auth();
  const [items, unreadCount, pendingCount] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { favoritedBy: { where: { userId: session!.user.id }, select: { id: true } } },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
    prisma.pendingItem.count({ where: { status: "PENDING" } }),
  ]);

  const totalWorth = items.reduce((sum, i) => sum + Number(i.suggestedPrice) * i.currentStock, 0);
  const lowStockCount = items.filter((i) => i.currentStock <= 5).length;
  const canSeeWorth = can(session!.user.rank, "canViewInventoryWorth");

  const formattedItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    suggestedPrice: Number(i.suggestedPrice),
    currentStock: i.currentStock,
    isFavorited: i.favoritedBy.length > 0,
  }));

  return (
    <>
      <Topbar pageTitle="Inventory" notificationCount={unreadCount} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className={`mb-6 grid grid-cols-1 gap-4 ${canSeeWorth ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {canSeeWorth && (
            <StatCard label="Total inventory worth" value={`$${totalWorth.toLocaleString()}`} icon={DollarSign} accent="success" />
          )}
          <StatCard label="Catalog items" value={items.length.toString()} icon={Package} />
          <StatCard label="Low stock (≤5)" value={lowStockCount.toString()} icon={AlertTriangle} accent={lowStockCount > 0 ? "danger" : "neutral"} />
        </div>

        {can(session!.user.rank, "canApprovePendingItems") && pendingCount > 0 && (
          <Link
            href="/inventory/pending"
            className="mb-6 flex items-center justify-between rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300 hover:bg-amber-950/30"
          >
            <span>{pendingCount} new item{pendingCount !== 1 ? "s" : ""} awaiting your approval</span>
            <span>Review →</span>
          </Link>
        )}

        {can(session!.user.rank, "canApproveItemActions") && (
          <Link
            href="/admin"
            className="mb-6 flex items-center justify-between rounded-lg border border-panel-border bg-panel/70 px-4 py-3 text-sm text-zinc-400 hover:bg-white/[0.04]"
          >
            <span>Approve donate/take/order requests on existing items</span>
            <span>Open admin panel →</span>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <InventoryActionForm items={formattedItems} defaultType="DONATE" />
          </div>

          <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-200">Catalog snapshot</h2>
              <Link href="/inventory/all" className="text-xs text-red-400 hover:text-red-300">
                View all {items.length} →
              </Link>
            </div>
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {formattedItems.slice(0, 12).map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{item.name}</span>
                  <span className="text-zinc-500">
                    {item.currentStock} · ${item.suggestedPrice.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Link href="/inventory/all" className="flex-1 rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 hover:bg-white/[0.04]">
                All items
              </Link>
              <Link href="/inventory/wishlist" className="flex-1 rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 hover:bg-white/[0.04]">
                Wishlist
              </Link>
              <Link href="/inventory/pending" className="flex-1 rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 hover:bg-white/[0.04]">
                Pending items
              </Link>
            </div>
            {can(session!.user.rank, "canViewTotalItemsAdded") && (
              <Link
                href="/inventory/totals"
                className="mt-2 block rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 hover:bg-white/[0.04]"
              >
                Total items added (all-time)
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
