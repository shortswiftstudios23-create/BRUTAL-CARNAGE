// app/(dashboard)/members/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { MembersClient } from "./members-client";
import { isInactive } from "@/lib/performance";

export default async function MembersPage() {
  const session = await auth();

  const [members, unreadCount] = await Promise.all([
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
  ]);

  return (
    <>
      <Topbar pageTitle="Members" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <MembersClient
          members={members.map((m) => ({
            id: m.id,
            username: m.username,
            discordAvatar: m.discordAvatar,
            rank: m.rank,
            isBlacklisted: m.isBlacklisted,
            blacklistReason: m.blacklistReason,
            lastActiveAt: m.lastActiveAt.toISOString(),
            joinedFamilyAt: m.joinedFamilyAt.toISOString(),
            isInactive: isInactive(m.lastActiveAt),
          }))}
          canManageBlacklist={can(session!.user.rank, "canManageBlacklist")}
          canViewPrivateNotes={can(session!.user.rank, "canViewPrivateNotes")}
        />
      </main>
    </>
  );
}
