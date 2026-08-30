// app/(dashboard)/inventory/pending/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PendingItemsClient } from "./pending-items-client";

export default async function PendingItemsPage() {
  const session = await auth();
  if (!can(session!.user.rank, "canApprovePendingItems")) redirect("/inventory");

  const [pendingItems, unreadCount] = await Promise.all([
    prisma.pendingItem.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { submittedBy: { select: { username: true } } },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Pending new items" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <Link href="/inventory" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
        <PendingItemsClient
          items={pendingItems.map((p) => ({
            id: p.id,
            name: p.name,
            suggestedPrice: Number(p.suggestedPrice),
            quantity: p.quantity,
            reason: p.reason,
            submittedBy: p.submittedBy.username,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
