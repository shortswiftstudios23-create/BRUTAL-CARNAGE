// app/(dashboard)/discipline/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DisciplineClient } from "./discipline-client";

export default async function DisciplinePage() {
  const session = await auth();
  if (!can(session!.user.rank, "canViewReports")) redirect("/dashboard");

  const [strikes, reports, blacklisted, members, unreadCount] = await Promise.all([
    prisma.strike.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true, rank: true } }, issuedBy: { select: { username: true } } },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reportedBy: { select: { username: true } },
        reportedUser: { select: { username: true, rank: true } },
      },
    }),
    prisma.user.findMany({ where: { isBlacklisted: true }, select: { id: true, username: true, blacklistReason: true } }),
    prisma.user.findMany({
      where: { isBlacklisted: false },
      select: { id: true, username: true, rank: true },
      orderBy: { username: "asc" },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Discipline" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DisciplineClient
          strikes={strikes.map((s) => ({
            id: s.id,
            username: s.user.username,
            rank: s.user.rank,
            issuedBy: s.issuedBy.username,
            severity: s.severity,
            reason: s.reason,
            syncedToDiscord: s.syncedToDiscord,
            createdAt: s.createdAt.toISOString(),
          }))}
          reports={reports.map((r) => ({
            id: r.id,
            reportedBy: r.reportedBy.username,
            reportedUser: r.reportedUser.username,
            reportedRank: r.reportedUser.rank,
            statement: r.statement,
            videoProofUrl: r.videoProofUrl,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          }))}
          blacklisted={blacklisted}
          canManageBlacklist={can(session!.user.rank, "canManageBlacklist")}
          canIssueStrike={can(session!.user.rank, "canIssueStrike")}
          members={members}
        />
      </main>
    </>
  );
}
