// app/(dashboard)/admin/page.tsx
// One panel for everything currently waiting on a decision — new item
// requests, donate/take actions on existing items, money transactions,
// and bank withdrawal requests — instead of admins having to go hunt
// through Inventory and Family Bank separately. Visible to Business
// Manager and up (Business Manager / admins, Under Deputy, Deputy,
// Boss, Big Boss) — the same roles that already have approve rights.
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AdminPanelClient } from "./admin-panel-client";

export default async function AdminPanelPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.rank, "canAccessAdminPanel")) redirect("/dashboard");

  const rank = session.user.rank;
  const [unreadCount, pendingItems, pendingItemActions, pendingTransactions, pendingBankRequests, pendingLoans] =
    await Promise.all([
      prisma.notification.count({ where: { userId: session.user.id, read: false } }),
      can(rank, "canApprovePendingItems")
        ? prisma.pendingItem.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: { submittedBy: { select: { username: true, rank: true } } },
          })
        : Promise.resolve([]),
      can(rank, "canApproveItemActions")
        ? prisma.itemAction.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true, rank: true } }, item: { select: { name: true } } },
          })
        : Promise.resolve([]),
      can(rank, "canApproveTransactions")
        ? prisma.transaction.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true, rank: true } }, soldItem: { select: { name: true } } },
          })
        : Promise.resolve([]),
      can(rank, "canApproveBankRequests")
        ? prisma.bankRequest.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true, rank: true } } },
          })
        : Promise.resolve([]),
      can(rank, "canApproveLoans")
        ? prisma.loan.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true, rank: true } } },
          })
        : Promise.resolve([]),
    ]);

  return (
    <>
      <Topbar pageTitle="Admin panel" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <AdminPanelClient
          canApprovePendingItems={can(rank, "canApprovePendingItems")}
          canApproveItemActions={can(rank, "canApproveItemActions")}
          canApproveTransactions={can(rank, "canApproveTransactions")}
          canApproveBankRequests={can(rank, "canApproveBankRequests")}
          canApproveLoans={can(rank, "canApproveLoans")}
          pendingItems={pendingItems.map((p) => ({
            id: p.id,
            name: p.name,
            suggestedPrice: Number(p.suggestedPrice),
            quantity: p.quantity,
            reason: p.reason,
            submittedBy: p.submittedBy.username,
            createdAt: p.createdAt.toISOString(),
          }))}
          pendingItemActions={pendingItemActions.map((a) => ({
            id: a.id,
            type: a.type,
            itemName: a.item.name,
            quantity: a.quantity,
            note: a.note,
            username: a.user.username,
            createdAt: a.createdAt.toISOString(),
          }))}
          pendingTransactions={pendingTransactions.map((t) => ({
            id: t.id,
            username: t.user.username,
            type: t.type,
            originalAmount: Number(t.originalAmount),
            taxAmount: Number(t.taxAmount),
            finalAmount: Number(t.finalAmount),
            note: t.note,
            soldItemName: t.soldItem?.name ?? null,
            soldQuantity: t.soldQuantity,
            createdAt: t.createdAt.toISOString(),
          }))}
          pendingBankRequests={pendingBankRequests.map((r) => ({
            id: r.id,
            username: r.user.username,
            amount: Number(r.amount),
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }))}
          pendingLoans={pendingLoans.map((l) => ({
            id: l.id,
            username: l.user.username,
            principal: Number(l.principal),
            interestRate: Number(l.interestRate),
            reason: l.reason,
            createdAt: l.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
