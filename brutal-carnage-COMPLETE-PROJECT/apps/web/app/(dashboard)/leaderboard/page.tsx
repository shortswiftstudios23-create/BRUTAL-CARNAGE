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
  const moneyGrouped = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { type: "DONATION", status: "APPROVED" },
    _sum: { finalAmount: true },
  });

  // Items donated to the family (approved DONATE actions), valued at each
  // item's suggested price so it can be combined with money into one
  // comparable "total worth contributed" figure.
  const itemActions = await prisma.itemAction.findMany({
    where: { type: "DONATE", status: "APPROVED" },
    include: { item: { select: { suggestedPrice: true } } },
  });

  const itemsValueByUser = new Map<string, number>();
  for (const action of itemActions) {
    const value = Number(action.item.suggestedPrice) * action.quantity;
    itemsValueByUser.set(action.userId, (itemsValueByUser.get(action.userId) ?? 0) + value);
  }

  const moneyByUser = new Map<string, number>();
  for (const g of moneyGrouped) {
    moneyByUser.set(g.userId, Number(g._sum.finalAmount ?? 0));
  }

  const allUserIds = new Set<string>([...moneyByUser.keys(), ...itemsValueByUser.keys()]);

  const leaderboardEntries = Array.from(allUserIds)
    .map((userId) => {
      const moneyDonated = moneyByUser.get(userId) ?? 0;
      const itemsDonatedValue = itemsValueByUser.get(userId) ?? 0;
      return { userId, moneyDonated, itemsDonatedValue, total: moneyDonated + itemsDonatedValue };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  const users = await prisma.user.findMany({
    where: { id: { in: leaderboardEntries.map((g) => g.userId) } },
    include: { badges: { include: { badge: true } } },
  });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <>
      <Topbar pageTitle="Leaderboard" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
          <div className="border-b border-zinc-800 px-5 py-4">
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
                      ${entry.total.toLocaleString()} <span className="text-xs font-normal text-zinc-500">total</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      ${entry.moneyDonated.toLocaleString()} money · ${entry.itemsDonatedValue.toLocaleString()} items
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
