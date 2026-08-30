// app/(dashboard)/members/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { MembersClient } from "./members-client";
import { isInactive } from "@/lib/performance";
import { getContributionLedger } from "@/lib/contributions";

export default async function MembersPage() {
  const session = await auth();
  const canViewFinancials = can(session!.user.rank, "canViewMemberPerformanceDetail");

  const [members, unreadCount, activeLoans, ledger] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        discordAvatar: true,
        rank: true,
        isBlacklisted: true,
        blacklistReason: true,
        lastActiveAt: true,
        joinedFamilyAt: true,
      },
      orderBy: { username: "asc" },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
    // Only PENDING/ACTIVE loans are "currently on the books" — PAID/REJECTED/
    // DEFAULTED loans don't need a live badge in the members table.
    canViewFinancials
      ? prisma.loan.findMany({
          where: { status: { in: ["PENDING", "ACTIVE"] } },
          select: { userId: true, status: true, amountOwed: true, dueAt: true },
        })
      : Promise.resolve([]),
    canViewFinancials ? getContributionLedger() : Promise.resolve(new Map()),
  ]);

  const loanByUser = new Map(activeLoans.map((l) => [l.userId, l]));

  return (
    <>
      <Topbar pageTitle="Members" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <MembersClient
          members={members.map((m) => {
            const entry = ledger.get(m.id);
            const loan = loanByUser.get(m.id);
            return {
              id: m.id,
              username: m.username,
              discordAvatar: m.discordAvatar,
              rank: m.rank,
              isBlacklisted: m.isBlacklisted,
              blacklistReason: m.blacklistReason,
              lastActiveAt: m.lastActiveAt.toISOString(),
              joinedFamilyAt: m.joinedFamilyAt.toISOString(),
              isInactive: isInactive(m.lastActiveAt),
              moneyDonated: entry?.moneyDonated ?? 0,
              itemsDonatedValue: entry?.itemsDonatedValue ?? 0,
              itemsTakenValue: entry?.itemsTakenValue ?? 0,
              moneyWithdrawn: entry?.moneyWithdrawn ?? 0,
              loanStatus: loan
                ? { status: loan.status as "PENDING" | "ACTIVE", amountOwed: Number(loan.amountOwed), dueAt: loan.dueAt?.toISOString() ?? null }
                : null,
            };
          })}
          canManageBlacklist={can(session!.user.rank, "canManageBlacklist")}
          canViewPrivateNotes={can(session!.user.rank, "canViewPrivateNotes")}
          canCreateMemberManually={can(session!.user.rank, "canCreateMemberManually")}
          canViewMemberPerformanceDetail={can(session!.user.rank, "canViewMemberPerformanceDetail")}
          canResetMemberPassword={can(session!.user.rank, "canResetMemberPassword")}
          canViewFinancials={canViewFinancials}
        />
      </main>
    </>
  );
}
