// app/(dashboard)/performance/[userId]/page.tsx
// Boss+ ("admins" — Boss and Big Boss) drill-down into one member: the
// full donation/withdrawal timeline with dates, item actions (valued,
// and split personal vs for-sale), loan history including collateral,
// and which events they registered for vs actually attended. Linked to
// from the Members page (see members-client.tsx) for anyone with
// canViewMemberPerformanceDetail. A member can also reach their own via
// /performance/[their own id] — self-view is always allowed.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Package,
  PackageMinus,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Landmark,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { RankBadge } from "@/components/layout/rank-badge";
import { StatCard } from "@/components/shared/stat-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getMemberDetailedHistory } from "@/lib/performance";

export default async function MemberPerformanceDetailPage({ params }: { params: { userId: string } }) {
  const session = await auth();
  const isSelf = session!.user.id === params.userId;
  if (!isSelf && !can(session!.user.rank, "canViewMemberPerformanceDetail")) {
    redirect("/performance");
  }

  const [user, unreadCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, username: true, rank: true, gameId: true, joinedFamilyAt: true },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);
  if (!user) notFound();

  const history = await getMemberDetailedHistory(user.id);

  const totalMoneyDonated = history.donations.reduce((s, d) => s + d.amount, 0);
  const totalMoneyWithdrawn = history.withdrawals.reduce((s, w) => s + w.amount, 0);
  const eventsAttended = history.events.filter((e) => e.attended).length;
  const netContributed = totalMoneyDonated + history.itemsDonatedValue - history.itemsTakenValue;

  const activeLoan = history.loans.find((l) => l.status === "ACTIVE" || l.status === "PENDING");

  return (
    <>
      <Topbar pageTitle={`Performance — ${user.username}`} notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <Link href="/members" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to members
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100">{user.username}</h1>
          <RankBadge rank={user.rank} />
          {user.gameId && <span className="text-xs text-zinc-500">Game ID: {user.gameId}</span>}
          <span className="ml-auto rounded-md border border-panel-border bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
            Net contributed: <span className={netContributed >= 0 ? "text-emerald-400" : "text-red-400"}>${netContributed.toLocaleString()}</span>
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Money donated" value={`$${totalMoneyDonated.toLocaleString()}`} icon={DollarSign} accent="success" />
          <StatCard label="Items donated (value)" value={`$${history.itemsDonatedValue.toLocaleString()}`} icon={Package} accent="success" />
          <StatCard label="Items taken (personal)" value={`$${history.itemsTakenValue.toLocaleString()}`} icon={PackageMinus} accent="danger" />
          <StatCard label="Events attended" value={`${eventsAttended} / ${history.events.length}`} icon={CalendarCheck} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Money withdrawn" value={`$${totalMoneyWithdrawn.toLocaleString()}`} icon={DollarSign} accent="danger" />
          {history.itemsTakenForSaleValue > 0 && (
            <StatCard label="Items taken for sale (family stock)" value={`$${history.itemsTakenForSaleValue.toLocaleString()}`} icon={Package} />
          )}
        </div>

        {activeLoan && (
          <div className="mb-6 rounded-lg border border-red-900/50 bg-red-950/10 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-red-400" />
              <h2 className="text-xs uppercase tracking-wider text-zinc-400">
                {activeLoan.status === "PENDING" ? "Loan request pending approval" : "Active loan"}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Principal</p>
                <p className="text-zinc-100">${activeLoan.principal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Owed now (incl. interest)</p>
                <p className="text-red-300">${activeLoan.amountOwed.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Interest accrued</p>
                <p className="text-zinc-100">${Math.max(0, activeLoan.amountOwed - activeLoan.principal).toLocaleString()}</p>
                <p className="text-xs text-zinc-600">{(activeLoan.interestRate * 100).toFixed(0)}% / 5 days</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Due</p>
                <p className="text-zinc-100">{activeLoan.dueAt ? new Date(activeLoan.dueAt).toLocaleDateString() : "Not set"}</p>
                <p className="text-xs text-zinc-600">Taken out {new Date(activeLoan.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            {activeLoan.collateralItems.length > 0 && (
              <div className="mt-4 border-t border-red-900/30 pt-3">
                <p className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500">Items held as collateral</p>
                <ul className="flex flex-wrap gap-2">
                  {activeLoan.collateralItems.map((c) => (
                    <li key={c.id} className="rounded border border-panel-border bg-white/[0.03] px-2 py-1 text-xs text-zinc-300">
                      {c.quantity}× {c.itemName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activeLoan.repayments.length > 0 && (
              <div className="mt-4 border-t border-red-900/30 pt-3">
                <p className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500">Repayments so far</p>
                <ul className="space-y-1 text-xs text-zinc-400">
                  {activeLoan.repayments.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span>${r.amount.toLocaleString()}</span>
                      <span className="text-zinc-600">{new Date(r.date).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activeLoan.reason && <p className="mt-3 text-xs text-zinc-500">Reason: {activeLoan.reason}</p>}
          </div>
        )}

        {history.loans.filter((l) => l.id !== activeLoan?.id).length > 0 && (
          <div className="mb-6 rounded-lg border border-panel-border bg-panel/70 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Loan history</h2>
            <ul className="divide-y divide-zinc-800">
              {history.loans
                .filter((l) => l.id !== activeLoan?.id)
                .map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-zinc-300">
                      ${l.principal.toLocaleString()} —{" "}
                      <span
                        className={
                          l.status === "PAID"
                            ? "text-emerald-400"
                            : l.status === "DEFAULTED"
                            ? "text-red-400"
                            : "text-zinc-500"
                        }
                      >
                        {l.status.toLowerCase()}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-600">{new Date(l.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-emerald-400/80">Donations</h2>
            <HistoryTable
              rows={history.donations.map((d) => ({
                left: `$${d.amount.toLocaleString()}`,
                right: new Date(d.date).toLocaleString(),
                note: d.note,
              }))}
              empty="No donations on record."
            />
          </div>

          <div className="rounded-lg border border-red-900/40 bg-red-950/10 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-red-400/80">Withdrawals</h2>
            <HistoryTable
              rows={history.withdrawals.map((w) => ({
                left: `$${w.amount.toLocaleString()}`,
                right: new Date(w.date).toLocaleString(),
                note: w.note,
              }))}
              empty="No withdrawals on record."
            />
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-panel-border bg-panel/70 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Item actions (donate / take)</h2>
          <HistoryTable
            rows={history.itemActions.map((a) => ({
              left: `${a.type === "DONATE" ? "Donated" : a.purpose === "FOR_SALE" ? "Took (for sale)" : "Took"} ${a.quantity}× ${a.itemName} — $${a.value.toLocaleString()}`,
              right: new Date(a.date).toLocaleString(),
            }))}
            empty="No inventory activity on record."
          />
        </div>

        <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Event participation</h2>
          {history.events.length === 0 ? (
            <p className="text-sm text-zinc-600">Hasn't registered for any events.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {history.events.map((e) => (
                <li key={e.eventId} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-zinc-300">{e.title}</span>
                  <span className="flex items-center gap-3 text-zinc-500">
                    {new Date(e.startsAt).toLocaleDateString()}
                    {e.attended ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Attended
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-600">
                        <XCircle className="h-3.5 w-3.5" /> Registered only
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function HistoryTable({ rows, empty }: { rows: { left: string; right: string; note?: string | null }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-600">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-800">
      {rows.map((r, i) => (
        <li key={i} className="py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300">{r.left}</span>
            <span className="text-zinc-500">{r.right}</span>
          </div>
          {r.note && <p className="mt-0.5 text-xs text-zinc-600">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}
