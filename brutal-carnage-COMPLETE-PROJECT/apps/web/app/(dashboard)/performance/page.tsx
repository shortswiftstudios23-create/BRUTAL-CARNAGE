// app/(dashboard)/performance/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { BadgePill } from "@/components/performance/badge-pill";
import { AiSummaryPanel } from "@/components/performance/ai-summary-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getMemberStats, isInactive, INACTIVE_DAYS_THRESHOLD } from "@/lib/performance";
import { DollarSign, CalendarCheck, Package, ShieldAlert } from "lucide-react";

export default async function PerformancePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [stats, unreadCount] = await Promise.all([
    getMemberStats(userId),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const showInactivePanel = can(session!.user.rank, "canViewDetailedLogs");
  const inactiveMembers = showInactivePanel
    ? await prisma.user.findMany({
        where: { isBlacklisted: false },
        select: { id: true, username: true, rank: true, lastActiveAt: true },
      }).then((members) => members.filter((m) => isInactive(m.lastActiveAt)))
    : [];

  return (
    <>
      <Topbar pageTitle="Performance" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total donated" value={`$${stats.totalDonated.toLocaleString()}`} icon={DollarSign} accent="success" />
          <StatCard
            label="Event show-up rate"
            value={stats.showUpRate !== null ? `${Math.round(stats.showUpRate * 100)}%` : "—"}
            icon={CalendarCheck}
          />
          <StatCard label="Inventory actions" value={stats.itemActionsCompleted.toString()} icon={Package} />
          <StatCard
            label="Strikes on record"
            value={stats.strikeCount.toString()}
            icon={ShieldAlert}
            accent={stats.strikeCount > 0 ? "danger" : "neutral"}
          />
        </div>

        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Badges earned</h2>
          {stats.badges.length === 0 ? (
            <p className="text-sm text-zinc-600">No badges yet — keep contributing and showing up to events.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.badges.map((name) => (
                <BadgePill key={name} name={name} />
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <AiSummaryPanel userId={userId} />
        </div>

        {showInactivePanel && (
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-amber-400">
              Inactive members ({INACTIVE_DAYS_THRESHOLD}+ days silent)
            </h2>
            {inactiveMembers.length === 0 ? (
              <p className="text-sm text-zinc-600">No one is currently flagged inactive.</p>
            ) : (
              <ul className="space-y-2">
                {inactiveMembers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{m.username}</span>
                    <span className="text-zinc-500">
                      {m.rank.replace(/_/g, " ")} · last active{" "}
                      {Math.floor((Date.now() - m.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))} days ago
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </>
  );
}
