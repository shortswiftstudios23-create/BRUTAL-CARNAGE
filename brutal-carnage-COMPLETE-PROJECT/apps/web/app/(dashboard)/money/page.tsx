// app/(dashboard)/money/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { MoneyFormsTabs } from "@/components/money/money-forms-tabs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Wallet, TrendingUp, Clock, Settings } from "lucide-react";
import Link from "next/link";
import { MoneyClient } from "./money-client";
import { MyLoanCard } from "@/components/money/my-loan-card";

export default async function MoneyPage() {
  const session = await auth();
  const canApprove = can(session!.user.rank, "canApproveTransactions");
  const canApproveBank = can(session!.user.rank, "canApproveBankRequests");

  const [balance, items, pendingTransactionCount, pendingBankCount, unreadCount] =
    await Promise.all([
      prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
      prisma.item.findMany({ select: { id: true, name: true, currentStock: true }, orderBy: { name: "asc" } }),
      prisma.transaction.count({ where: { status: "PENDING" } }),
      prisma.bankRequest.count({ where: { status: "PENDING" } }),
      prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
    ]);

  const myPendingRequestsCount = await prisma.bankRequest.count({
    where: { userId: session!.user.id, status: "PENDING" },
  });

  const myLoan = await prisma.loan.findFirst({
    where: { userId: session!.user.id, status: { in: ["PENDING", "ACTIVE"] } },
  });

  return (
    <>
      <Topbar pageTitle="Family bank" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        {can(session!.user.rank, "canManageCategories") && (
          <div className="mb-4 flex justify-end">
            <Link
              href="/money/categories"
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            >
              <Settings className="h-3.5 w-3.5" />
              Manage categories
            </Link>
          </div>
        )}
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

        <div className="mx-auto max-w-xl">
          {myLoan && (
            <MyLoanCard
              loan={{
                id: myLoan.id,
                status: myLoan.status as "PENDING" | "ACTIVE",
                principal: Number(myLoan.principal),
                amountOwed: Number(myLoan.amountOwed),
                interestRate: Number(myLoan.interestRate),
              }}
            />
          )}
          <MoneyFormsTabs items={items} hasActiveLoan={!!myLoan} />
        </div>

        <MoneyClient
          canApprove={canApprove}
          canApproveBank={canApproveBank}
          pendingTransactionCount={pendingTransactionCount}
          pendingBankRequestCount={pendingBankCount}
          myPendingRequestsCount={myPendingRequestsCount}
        />
      </main>
    </>
  );
}
