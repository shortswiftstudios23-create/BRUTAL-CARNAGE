// app/(dashboard)/inventory/totals/page.tsx
// Deputy+ view: every item ever added historically (sum of all approved
// DONATE actions, all-time), separate from /inventory/all which shows
// only what's CURRENTLY in stock (donations minus takes). This answers
// "how much has ever come in in total", and lets Deputy+ correct an
// item's catalog name/price.

import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TotalsClient } from "./totals-client";

export default async function TotalItemsAddedPage() {
  const session = await auth();
  if (!can(session!.user.rank, "canViewTotalItemsAdded")) redirect("/inventory");

  const [items, totals, unreadCount] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.itemAction.groupBy({
      by: ["itemId"],
      where: { type: "DONATE", status: "APPROVED" },
      _sum: { quantity: true },
      _count: true,
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  const totalByItemId = new Map(totals.map((t) => [t.itemId, { qty: t._sum.quantity ?? 0, entries: t._count }]));

  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    suggestedPrice: Number(i.suggestedPrice),
    totalAdded: totalByItemId.get(i.id)?.qty ?? 0,
    entryCount: totalByItemId.get(i.id)?.entries ?? 0,
  }));

  return (
    <>
      <Topbar pageTitle="Total items added" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/inventory" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
        <p className="mb-4 text-sm text-zinc-500">
          Every item ever donated to the family, all-time — not just what's currently in stock. Click a
          name or price to correct it.
        </p>
        <TotalsClient rows={rows} canEdit={can(session!.user.rank, "canEditItemCatalog")} />
      </main>
    </>
  );
}
