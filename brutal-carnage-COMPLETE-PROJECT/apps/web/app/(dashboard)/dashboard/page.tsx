// app/(dashboard)/dashboard/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { RankBadge } from "@/components/layout/rank-badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reconcileWidgetPrefs, WidgetPref } from "@/lib/widgets";
import { Wallet, Package, Users, CalendarDays, Trophy, Megaphone, ClipboardCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { WidgetPicker } from "@/components/dashboard/widget-picker";
import Link from "next/link";

// recharts is a large client-only dependency. Loading it via a plain
// top-level import pulls it into this route's server-rendered HTML path
// and into the initial client bundle for every visit to /dashboard, even
// for the split second before the chart is visible. `dynamic(...)` with
// ssr:false defers fetching/executing that JS until after first paint,
// swapping in a lightweight skeleton until it's ready — first load gets
// noticeably lighter without changing what the user sees once it settles.
const BalanceChart = dynamic(
  () => import("@/components/dashboard/balance-chart").then((m) => m.BalanceChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full animate-pulse rounded-lg bg-white/[0.03]" />
    ),
  }
);

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [
    user,
    template,
    balance,
    itemCount,
    memberCount,
    upcomingEvents,
    recentActivity,
    unreadCount,
    pendingCounts,
    topContributors,
    pinnedAnnouncements,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dashboardWidgets: true } }),
    prisma.dashboardWidgetTemplate.findUnique({ where: { id: "default" } }),
    prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
    prisma.item.count(),
    prisma.user.count({ where: { isBlacklisted: false } }),
    prisma.event.findMany({ where: { status: "SCHEDULED" }, orderBy: { startsAt: "asc" }, take: 3 }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { username: true, rank: true } } },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    Promise.all([
      prisma.pendingItem.count({ where: { status: "PENDING" } }),
      prisma.transaction.count({ where: { status: "PENDING" } }),
      prisma.bankRequest.count({ where: { status: "PENDING" } }),
    ]),
    prisma.itemAction.groupBy({
      by: ["userId"],
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
    prisma.announcement.findMany({ where: { pinned: true }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  // Real balance history for the chart — see BalanceSnapshot / lib/balance.ts.
  const balanceSnapshots = await prisma.balanceSnapshot.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "asc" },
  });
  const balanceHistory = balanceSnapshots.length
    ? balanceSnapshots.map((s) => ({ date: s.createdAt.toISOString(), balance: Number(s.balance) }))
    : [{ date: new Date().toISOString(), balance: Number(balance?.balance ?? 0) }];

  const prefs: WidgetPref[] = reconcileWidgetPrefs(
    (user?.dashboardWidgets as unknown as WidgetPref[]) ??
      (template?.widgets as unknown as WidgetPref[]) ??
      null
  );
  const isEnabled = (id: string) => prefs.find((p) => p.id === id)?.enabled ?? false;
  const orderOf = (id: string) => prefs.find((p) => p.id === id)?.order ?? 999;

  const [pendingItems, pendingTx, pendingBank] = pendingCounts;
  const totalPending = pendingItems + pendingTx + pendingBank;

  const contributorUsers = topContributors.length
    ? await prisma.user.findMany({
        where: { id: { in: topContributors.map((c) => c.userId) } },
        select: { id: true, username: true, rank: true },
      })
    : [];
  const contributorMap = new Map(contributorUsers.map((u) => [u.id, u]));

  const smallWidgets = ["balance", "inventory_count", "member_count", "upcoming_event_count"]
    .filter(isEnabled)
    .sort((a, b) => orderOf(a) - orderOf(b));

  const largeWidgets = [
    "balance_chart",
    "upcoming_events",
    "recent_activity",
    "pending_approvals",
    "leaderboard_preview",
    "announcements_preview",
  ]
    .filter(isEnabled)
    .sort((a, b) => orderOf(a) - orderOf(b));

  return (
    <>
      <Topbar pageTitle="Dashboard" notificationCount={unreadCount} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <WidgetPicker initialPrefs={prefs} canSetFamilyDefault={can(session!.user.rank, "canManageAdminWidgets")} />
        </div>

        {smallWidgets.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {smallWidgets.includes("balance") && (
              <StatCard
                label="Family balance"
                value={`$${Number(balance?.balance ?? 0).toLocaleString()}`}
                icon={Wallet}
                accent="success"
              />
            )}
            {smallWidgets.includes("inventory_count") && (
              <StatCard label="Inventory items" value={itemCount.toString()} icon={Package} />
            )}
            {smallWidgets.includes("member_count") && (
              <StatCard label="Active members" value={memberCount.toString()} icon={Users} />
            )}
            {smallWidgets.includes("upcoming_event_count") && (
              <StatCard
                label="Upcoming events"
                value={upcomingEvents.length.toString()}
                icon={CalendarDays}
                accent={upcomingEvents.length > 0 ? "danger" : "neutral"}
              />
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {largeWidgets.includes("balance_chart") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-200">Family balance — last 30 days</h2>
                <Link href="/money/history" className="text-xs text-red-400 hover:text-red-300">
                  View full history →
                </Link>
              </div>
              <BalanceChart history={balanceHistory} />
            </div>
          )}

          {largeWidgets.includes("upcoming_events") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="mb-4 text-sm font-medium text-zinc-200">Upcoming events</h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-zinc-600">No events scheduled. Create one to rally the family.</p>
              ) : (
                <ul className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="border-l-2 border-red-800 pl-3">
                      <p className="text-sm text-zinc-200">{event.title}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(event.startsAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/events"
                className="mt-4 block rounded-md border border-zinc-800 py-2 text-center text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                View all events
              </Link>
            </div>
          )}

          {largeWidgets.includes("pending_approvals") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-medium text-zinc-200">Pending approvals</h2>
                {totalPending > 0 && (
                  <span className="ml-auto rounded-full bg-amber-950/50 px-2 py-0.5 text-xs text-amber-400">
                    {totalPending}
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between text-zinc-400">
                  <span>New item submissions</span>
                  <span className="text-zinc-200">{pendingItems}</span>
                </li>
                <li className="flex justify-between text-zinc-400">
                  <span>Transactions awaiting review</span>
                  <span className="text-zinc-200">{pendingTx}</span>
                </li>
                <li className="flex justify-between text-zinc-400">
                  <span>Bank requests</span>
                  <span className="text-zinc-200">{pendingBank}</span>
                </li>
              </ul>
              {totalPending === 0 && <p className="mt-2 text-xs text-zinc-600">Nothing waiting on you right now.</p>}
            </div>
          )}

          {largeWidgets.includes("leaderboard_preview") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-medium text-zinc-200">Top contributors</h2>
              </div>
              <ul className="space-y-3">
                {topContributors.map((c, i) => {
                  const u = contributorMap.get(c.userId);
                  if (!u) return null;
                  return (
                    <li key={c.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600">#{i + 1}</span>
                        <span className="text-zinc-200">{u.username}</span>
                        <RankBadge rank={u.rank} />
                      </div>
                      <span className="text-zinc-500">{c._count._all} actions</span>
                    </li>
                  );
                })}
                {topContributors.length === 0 && <p className="text-sm text-zinc-600">No activity logged yet.</p>}
              </ul>
              <Link
                href="/leaderboard"
                className="mt-4 block rounded-md border border-zinc-800 py-2 text-center text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                Full leaderboard
              </Link>
            </div>
          )}

          {largeWidgets.includes("announcements_preview") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-medium text-zinc-200">Pinned announcements</h2>
              </div>
              <ul className="space-y-3">
                {pinnedAnnouncements.map((a) => (
                  <li key={a.id} className="border-l-2 border-red-800 pl-3">
                    <p className="text-sm text-zinc-200">{a.title}</p>
                    <p className="truncate text-xs text-zinc-500">{a.content}</p>
                  </li>
                ))}
                {pinnedAnnouncements.length === 0 && (
                  <p className="text-sm text-zinc-600">Nothing pinned right now.</p>
                )}
              </ul>
              <Link
                href="/announcements"
                className="mt-4 block rounded-md border border-zinc-800 py-2 text-center text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                View all announcements
              </Link>
            </div>
          )}
        </div>

        {largeWidgets.includes("recent_activity") && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-200">Recent activity</h2>
            <ul className="divide-y divide-zinc-900">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300">{log.user?.username ?? "System"}</span>
                    {log.user && <RankBadge rank={log.user.rank} />}
                    <span className="text-zinc-500">{formatAction(log.action)}</span>
                  </div>
                  <span className="text-xs text-zinc-600">
                    {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
              {recentActivity.length === 0 && (
                <li className="py-6 text-center text-sm text-zinc-600">Nothing logged yet.</li>
              )}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase();
}
