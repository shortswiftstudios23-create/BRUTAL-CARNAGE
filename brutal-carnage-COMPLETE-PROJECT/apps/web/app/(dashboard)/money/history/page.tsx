// app/(dashboard)/money/history/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { effectiveDate } from "@/lib/backdate";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-800 bg-amber-950/40 text-amber-300",
  APPROVED: "border-green-800 bg-green-950/40 text-green-300",
  REJECTED: "border-red-900 bg-red-950/40 text-red-300",
};

function formatType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function MoneyHistoryPage() {
  const session = await auth();
  const canViewAll = can(session!.user.rank, "canViewDetailedLogs");

  const [transactions, bankRequests, unreadCount] = await Promise.all([
    prisma.transaction.findMany({
      where: canViewAll ? undefined : { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { username: true } } },
    }),
    prisma.bankRequest.findMany({
      where: canViewAll ? undefined : { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { username: true } } },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Money history" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/money" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to family bank
        </Link>

        {!canViewAll && (
          <p className="mb-4 text-xs text-zinc-500">Showing your own history. Detailed family-wide logs are visible to Business Manager and above.</p>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-200">Transactions</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  {canViewAll && <th className="px-4 py-2 text-left">Member</th>}
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {transactions.map((t) => (
                  <tr key={t.id} className="bg-zinc-950/40">
                    {canViewAll && <td className="px-4 py-2 text-zinc-300">{t.user.username}</td>}
                    <td className="px-4 py-2 text-zinc-300">{formatType(t.type)}</td>
                    <td className="px-4 py-2 text-right text-zinc-200">${Number(t.finalAmount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {effectiveDate(t).toLocaleDateString()}
                      {t.occurredAt && <span className="ml-1 text-[10px] text-amber-500">(backdated)</span>}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">No transactions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-200">Bank requests</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  {canViewAll && <th className="px-4 py-2 text-left">Member</th>}
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {bankRequests.map((r) => (
                  <tr key={r.id} className="bg-zinc-950/40">
                    {canViewAll && <td className="px-4 py-2 text-zinc-300">{r.user.username}</td>}
                    <td className="px-4 py-2 text-zinc-300">{r.reason}</td>
                    <td className="px-4 py-2 text-right text-zinc-200">${Number(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{r.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
                {bankRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">No bank requests yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
