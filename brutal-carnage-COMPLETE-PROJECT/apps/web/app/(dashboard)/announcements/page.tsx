// app/(dashboard)/announcements/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { AnnouncementsClient } from "./announcements-client";

export default async function AnnouncementsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [announcements, unreadCount] = await Promise.all([
    prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const authorIds = [...new Set(announcements.map((a) => a.createdById))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, username: true, rank: true },
  });
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return (
    <>
      <Topbar pageTitle="Announcements" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <AnnouncementsClient
          canManage={can(session!.user.rank, "canManageAnnouncements")}
          announcements={announcements.map((a) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            pinned: a.pinned,
            createdAt: a.createdAt.toISOString(),
            author: authorMap.get(a.createdById)?.username ?? "System",
          }))}
        />
      </main>
    </>
  );
}
