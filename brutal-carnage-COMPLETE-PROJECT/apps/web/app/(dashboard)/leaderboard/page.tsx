// app/(dashboard)/leaderboard/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { RankBadge } from "@/components/layout/rank-badge";
import { BadgePill } from "@/components/performance/badge-pill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";

export default async function LeaderboardPage() {
  const session = await auth();
  const unreadCount = await prisma.notification.count({
    where: { userId: session!.user.id, read: false },
  });

  // Only DONATION counts toward the public leaderboard — SOLD_ITEMS income
  // is a business transaction, not a personal contribution, so it's
  // deliberately excluded here.
  const grouped = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { type: "DONATION", status: "APPROVED" },
    _sum: { finalAmount: true },
    orderBy: { _sum: { finalAmount: "desc" } },
    take: 25,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    include: { badges: { include: { badge: true } } },
  });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <>
      <Topbar pageTitle="Leaderboard" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h1 className="flex items-center gap-2 font-display text-lg tracking-wide text-zinc-100">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top contributors
            </h1>
          </div>
          <ul className="divide-y divide-zinc-800">
            {grouped.map((entry, i) => {
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
                  <span className="font-display text-base text-zinc-100">
                    ${Number(entry._sum.finalAmount ?? 0).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
