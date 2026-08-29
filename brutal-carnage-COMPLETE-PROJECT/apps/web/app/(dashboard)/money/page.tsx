// app/(dashboard)/money/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { TransactionForm } from "@/components/money/transaction-form";
import { BankRequestForm } from "@/components/money/bank-request-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Wallet, TrendingUp, Clock } from "lucide-react";
import { MoneyClient } from "./money-client";

export default async function MoneyPage() {
  const session = await auth();
  const canApprove = can(session!.user.rank, "canApproveTransactions");
  const canApproveBank = can(session!.user.rank, "canApproveBankRequests");

  const [balance, items, pendingTransactionCount, pendingBankCount, unreadCount, pendingTransactions, pendingBankRequests] =
    await Promise.all([
      prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
      prisma.item.findMany({ select: { id: true, name: true, currentStock: true }, orderBy: { name: "asc" } }),
      prisma.transaction.count({ where: { status: "PENDING" } }),
      prisma.bankRequest.count({ where: { status: "PENDING" } }),
      prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
      canApprove
        ? prisma.transaction.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { user: { select: { username: true, rank: true } }, soldItem: { select: { name: true } } },
          })
        : Promise.resolve([]),
      canApproveBank
        ? prisma.bankRequest.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { user: { select: { username: true, rank: true } } },
          })
        : Promise.resolve([]),
    ]);

  const myPendingRequestsCount = await prisma.bankRequest.count({
    where: { userId: session!.user.id, status: "PENDING" },
  });

  return (
    <>
      <Topbar pageTitle="Family bank" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Family balance"
            value={`$${Number(balance?.balance ?? 0).toLocaleString()}`}
            icon={Wallet}
            accent="success"
          />
          <StatCard label="Pending transactions" value={pendingTransactionCount.toString()} icon={TrendingUp} />
          <StatCard label="Pending bank requests" value={pendingBankCount.toString()} icon={Clock} accent={pendingBankCount > 0 ? "danger" : "neutral"} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TransactionForm items={items} />
          <BankRequestForm />
        </div>

        <MoneyClient
          canApprove={canApprove}
          canApproveBank={canApproveBank}
          pendingTransactions={pendingTransactions.map((t) => ({
            id: t.id,
            username: t.user.username,
            rank: t.user.rank,
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
            rank: r.user.rank,
            amount: Number(r.amount),
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }))}
          myPendingRequestsCount={myPendingRequestsCount}
        />
      </main>
    </>
  );
}
