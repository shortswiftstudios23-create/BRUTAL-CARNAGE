// app/(dashboard)/leaderboard/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { RankBadge } from "@/components/layout/rank-badge";
import { BadgePill } from "@/components/performance/badge-pill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Trophy, CalendarCheck, PackageMinus } from "lucide-react";
import { getTopContributors } from "@/lib/contributions";

export default async function LeaderboardPage() {
  const session = await auth();
  const unreadCount = await prisma.notification.count({
    where: { userId: session!.user.id, read: false },
  });

  // Money + items donated minus personal items taken — see
  // lib/contributions.ts for the shared rules. This is the exact same
  // computation the dashboard's "Top contributors" preview widget uses,
  // so the two never disagree.
  const leaderboardEntries = (await getTopContributors(25)).map((e) => ({
    userId: e.userId,
    moneyDonated: e.moneyDonated,
    itemsDonatedValue: e.itemsDonatedValue,
    itemsTakenValue: e.itemsTakenValue,
    eventsAttended: e.eventsAttended,
    total: e.netContributed,
  }));

  const users = await prisma.user.findMany({
    where: { id: { in: leaderboardEntries.map((g) => g.userId) } },
    include: { badges: { include: { badge: true } } },
  });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <>
      <Topbar pageTitle="Leaderboard" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-panel-border bg-panel/70">
          <div className="border-b border-panel-border px-5 py-4">
            <h1 className="flex items-center gap-2 font-display text-lg tracking-wide text-zinc-100">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top contributors
            </h1>
          </div>
          <ul className="divide-y divide-zinc-800">
            {leaderboardEntries.map((entry, i) => {
              const user = userById[entry.userId];
              if (!user) return null;
              return (
                <li key={entry.userId} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-4">
                    <span
                      className={
                        i === 0
                          ? "font-display text-lg text-amber-400"
                          : i === 1
                          ? "font-display text-lg text-zinc-300"
                          : i === 2
                          ? "font-display text-lg text-orange-400"
                          : "w-6 text-sm text-zinc-600"
                      }
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm text-zinc-200">{user.username}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <RankBadge rank={user.rank} />
                        {user.badges.slice(0, 2).map((b) => (
                          <BadgePill key={b.badgeId} name={b.badge.name} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base text-zinc-100">
                      ${entry.total.toLocaleString()} <span className="text-xs font-normal text-zinc-500">net</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      ${entry.moneyDonated.toLocaleString()} money · ${entry.itemsDonatedValue.toLocaleString()} items donated
                    </p>
                    <p className="mt-0.5 flex items-center justify-end gap-3 text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3" /> {entry.eventsAttended} events
                      </span>
                      {entry.itemsTakenValue > 0 && (
                        <span className="flex items-center gap-1 text-red-500/80">
                          <PackageMinus className="h-3 w-3" /> -${entry.itemsTakenValue.toLocaleString()} taken
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
