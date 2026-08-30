// app/(dashboard)/dashboard/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { RankBadge } from "@/components/layout/rank-badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reconcileWidgetPrefs, WidgetPref } from "@/lib/widgets";
import { getTopContributors, getContributionLedger } from "@/lib/contributions";
import {
  Wallet,
  Package,
  Users,
  CalendarDays,
  Trophy,
  Megaphone,
  ClipboardCheck,
  DollarSign,
  PackageMinus,
  CalendarCheck,
} from "lucide-react";
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
      <div className="h-[260px] w-full animate-pulse rounded-lg bg-white/[0.03]" />
    ),
  }
);

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const canSeeInventoryWorth = can(session!.user.rank, "canViewInventoryWorth");

  const [
    user,
    template,
    balance,
    items,
    memberCount,
    upcomingEvents,
    recentActivity,
    unreadCount,
    pendingCounts,
    pinnedAnnouncements,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dashboardWidgets: true } }),
    prisma.dashboardWidgetTemplate.findUnique({ where: { id: "default" } }),
    prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
    prisma.item.findMany({ select: { id: true, name: true, suggestedPrice: true, currentStock: true } }),
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
    prisma.announcement.findMany({ where: { pinned: true }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  const itemCount = items.length;
  const inventoryWorth = items.reduce((sum, i) => sum + Number(i.suggestedPrice) * i.currentStock, 0);
  const LOW_STOCK_THRESHOLD = 5;
  const lowStockItems = items
    .filter((i) => i.currentStock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.currentStock - b.currentStock);

  // Shared contribution ledger — same numbers as /leaderboard and
  // /members, so this preview never disagrees with the full pages.
  const topContributorEntries = await getTopContributors(5);
  const contributorUsers = topContributorEntries.length
    ? await prisma.user.findMany({
        where: { id: { in: topContributorEntries.map((c) => c.userId) } },
        select: { id: true, username: true, rank: true },
      })
    : [];
  const contributorMap = new Map(contributorUsers.map((u) => [u.id, u]));

  // Who has taken the most out of the warehouse for personal use
  // (FOR_SALE takes excluded — those are business, not personal, per
  // lib/contributions.ts). Lets leadership see this at a glance instead
  // of digging through each member's performance page one at a time.
  const fullLedger = Array.from((await getContributionLedger()).values());
  const topTakers = fullLedger
    .filter((e) => e.itemsTakenValue > 0)
    .sort((a, b) => b.itemsTakenValue - a.itemsTakenValue)
    .slice(0, 5);
  const takerUsers = topTakers.length
    ? await prisma.user.findMany({
        where: { id: { in: topTakers.map((t) => t.userId) } },
        select: { id: true, username: true, rank: true },
      })
    : [];
  const takerMap = new Map(takerUsers.map((u) => [u.id, u]));

  // Real balance history for the chart — see BalanceSnapshot / lib/balance.ts —
  // combined with daily money donated, item-value donated, and events
  // held, so the "family balance" chart isn't the only story on the
  // dashboard: it shows the shape of contribution activity too.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [balanceSnapshots, donationTx, donateActions, eventsInRange] = await Promise.all([
    prisma.balanceSnapshot.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { type: "DONATION", status: "APPROVED", createdAt: { gte: thirtyDaysAgo } },
      select: { finalAmount: true, occurredAt: true, createdAt: true },
    }),
    prisma.itemAction.findMany({
      where: { type: "DONATE", status: "APPROVED", createdAt: { gte: thirtyDaysAgo } },
      select: { quantity: true, occurredAt: true, createdAt: true, item: { select: { suggestedPrice: true } } },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: thirtyDaysAgo } },
      select: { startsAt: true },
    }),
  ]);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const moneyByDay = new Map<string, number>();
  for (const t of donationTx) {
    const k = dayKey(new Date(t.occurredAt ?? t.createdAt));
    moneyByDay.set(k, (moneyByDay.get(k) ?? 0) + Number(t.finalAmount));
  }
  const itemsByDay = new Map<string, number>();
  for (const a of donateActions) {
    const k = dayKey(new Date(a.occurredAt ?? a.createdAt));
    itemsByDay.set(k, (itemsByDay.get(k) ?? 0) + Number(a.item.suggestedPrice) * a.quantity);
  }
  const eventsByDay = new Map<string, number>();
  for (const e of eventsInRange) {
    const k = dayKey(new Date(e.startsAt));
    eventsByDay.set(k, (eventsByDay.get(k) ?? 0) + 1);
  }

  const balanceHistory = balanceSnapshots.length
    ? balanceSnapshots.map((s) => ({ date: s.createdAt.toISOString(), balance: Number(s.balance) }))
    : [{ date: new Date().toISOString(), balance: Number(balance?.balance ?? 0) }];

  // One combined series, keyed by every day that appears in ANY of the
  // three sources so the activity chart doesn't miss a day that only had
  // (say) an event and no donations.
  const allDayKeys = new Set<string>([
    ...balanceHistory.map((p) => dayKey(new Date(p.date))),
    ...moneyByDay.keys(),
    ...itemsByDay.keys(),
    ...eventsByDay.keys(),
  ]);
  const sortedDays = Array.from(allDayKeys).sort();
  const activityHistory = sortedDays.map((k) => ({
    date: k,
    moneyDonated: moneyByDay.get(k) ?? 0,
    itemsDonatedValue: itemsByDay.get(k) ?? 0,
    events: eventsByDay.get(k) ?? 0,
  }));

  const prefs: WidgetPref[] = reconcileWidgetPrefs(
    (user?.dashboardWidgets as unknown as WidgetPref[]) ??
      (template?.widgets as unknown as WidgetPref[]) ??
      null
  );
  const isEnabled = (id: string) => prefs.find((p) => p.id === id)?.enabled ?? false;
  const orderOf = (id: string) => prefs.find((p) => p.id === id)?.order ?? 999;

  const [pendingItems, pendingTx, pendingBank] = pendingCounts;
  const totalPending = pendingItems + pendingTx + pendingBank;

  const smallWidgets = [
    "balance",
    "inventory_count",
    "inventory_worth",
    "member_count",
    "upcoming_event_count",
  ]
    .filter((id) => id !== "inventory_worth" || canSeeInventoryWorth)
    .filter(isEnabled)
    .sort((a, b) => orderOf(a) - orderOf(b));

  const largeWidgets = [
    "balance_chart",
    "upcoming_events",
    "recent_activity",
    "pending_approvals",
    "leaderboard_preview",
    "items_taken_preview",
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
            {smallWidgets.includes("inventory_worth") && (
              <StatCard
                label="Inventory worth"
                value={`$${inventoryWorth.toLocaleString()}`}
                icon={DollarSign}
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

        {lowStockItems.length > 0 && (
          <Link
            href="/inventory/all"
            className="mt-4 block rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300 hover:bg-amber-950/30"
          >
            <span className="font-medium">Low stock ({lowStockItems.length}):</span>{" "}
            {lowStockItems
              .slice(0, 6)
              .map((i) => `${i.name} (${i.currentStock})`)
              .join(", ")}
            {lowStockItems.length > 6 && ` +${lowStockItems.length - 6} more`}
          </Link>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {largeWidgets.includes("balance_chart") && (
            <div className="panel rounded-xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-200">Family activity — last 30 days</h2>
                <Link href="/money/history" className="text-xs text-red-400 hover:text-red-300">
                  View full history →
                </Link>
              </div>
              <BalanceChart history={balanceHistory} activity={activityHistory} />
            </div>
          )}

          {largeWidgets.includes("upcoming_events") && (
            <div className="panel rounded-xl p-5">
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
                className="mt-4 block rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 transition-colors hover:border-crimson-dark/60 hover:bg-white/[0.04] hover:text-zinc-100"
              >
                View all events
              </Link>
            </div>
          )}

          {largeWidgets.includes("pending_approvals") && (
            <div className="panel rounded-xl p-5">
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
            <div className="panel rounded-xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-medium text-zinc-200">Top contributors</h2>
              </div>
              <ul className="space-y-3">
                {topContributorEntries.map((c, i) => {
                  const u = contributorMap.get(c.userId);
                  if (!u) return null;
                  return (
                    <li key={c.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600">#{i + 1}</span>
                        <span className="text-zinc-200">{u.username}</span>
                        <RankBadge rank={u.rank} />
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-200">${c.netContributed.toLocaleString()}</p>
                        <p className="flex items-center justify-end gap-2 text-xs text-zinc-600">
                          <span className="flex items-center gap-1">
                            <CalendarCheck className="h-3 w-3" /> {c.eventsAttended}
                          </span>
                          <span>${c.moneyDonated.toLocaleString()} money</span>
                          <span>${c.itemsDonatedValue.toLocaleString()} items</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
                {topContributorEntries.length === 0 && <p className="text-sm text-zinc-600">No activity logged yet.</p>}
              </ul>
              <Link
                href="/leaderboard"
                className="mt-4 block rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 transition-colors hover:border-crimson-dark/60 hover:bg-white/[0.04] hover:text-zinc-100"
              >
                Full leaderboard
              </Link>
            </div>
          )}

          {largeWidgets.includes("items_taken_preview") && (
            <div className="panel rounded-xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <PackageMinus className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-medium text-zinc-200">Most taken from inventory</h2>
              </div>
              <p className="mb-3 text-xs text-zinc-600">
                Personal takes only — items pulled to sell on the family's behalf don't count here.
              </p>
              <ul className="space-y-3">
                {topTakers.map((t, i) => {
                  const u = takerMap.get(t.userId);
                  if (!u) return null;
                  return (
                    <li key={t.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600">#{i + 1}</span>
                        <span className="text-zinc-200">{u.username}</span>
                        <RankBadge rank={u.rank} />
                      </div>
                      <span className="text-red-400">-${t.itemsTakenValue.toLocaleString()}</span>
                    </li>
                  );
                })}
                {topTakers.length === 0 && <p className="text-sm text-zinc-600">Nobody has taken items for personal use.</p>}
              </ul>
            </div>
          )}

          {largeWidgets.includes("announcements_preview") && (
            <div className="panel rounded-xl p-5">
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
                className="mt-4 block rounded-md border border-panel-border py-2 text-center text-xs text-zinc-400 transition-colors hover:border-crimson-dark/60 hover:bg-white/[0.04] hover:text-zinc-100"
              >
                View all announcements
              </Link>
            </div>
          )}
        </div>

        {largeWidgets.includes("recent_activity") && (
          <div className="mt-6 panel rounded-xl p-5">
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
