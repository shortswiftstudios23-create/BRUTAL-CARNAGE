// app/(dashboard)/performance/[userId]/page.tsx
// Boss+ ("admins" — Boss and Big Boss) drill-down into one member: the
// full donation/withdrawal timeline with dates, item actions, and which
// events they registered for vs actually attended. Linked to from the
// Members page (see members-client.tsx) for anyone with
// canViewMemberPerformanceDetail. A member can also reach their own via
// /performance/[their own id] — self-view is always allowed.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, DollarSign, Package, CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
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

  const totalDonated = history.donations.reduce((s, d) => s + d.amount, 0);
  const totalWithdrawn = history.withdrawals.reduce((s, w) => s + w.amount, 0);
  const eventsAttended = history.events.filter((e) => e.attended).length;

  return (
    <>
      <Topbar pageTitle={`Performance — ${user.username}`} notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/members" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to members
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100">{user.username}</h1>
          <RankBadge rank={user.rank} />
          {user.gameId && <span className="text-xs text-zinc-500">Game ID: {user.gameId}</span>}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total donated" value={`$${totalDonated.toLocaleString()}`} icon={DollarSign} accent="success" />
          <StatCard label="Total withdrawn" value={`$${totalWithdrawn.toLocaleString()}`} icon={DollarSign} accent="danger" />
          <StatCard label="Item actions" value={history.itemActions.length.toString()} icon={Package} />
          <StatCard label="Events attended" value={`${eventsAttended} / ${history.events.length}`} icon={CalendarCheck} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Donations</h2>
            <HistoryTable
              rows={history.donations.map((d) => ({
                left: `$${d.amount.toLocaleString()}`,
                right: new Date(d.date).toLocaleString(),
                note: d.note,
              }))}
              empty="No donations on record."
            />
          </div>

          <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Withdrawals</h2>
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
              left: `${a.type === "DONATE" ? "Donated" : "Took"} ${a.quantity}× ${a.itemName}`,
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
