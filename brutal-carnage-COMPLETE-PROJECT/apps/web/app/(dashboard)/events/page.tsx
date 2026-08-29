// app/(dashboard)/events/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const session = await auth();
  const [events, unreadCount] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          where: { userId: session!.user.id },
          select: { id: true },
        },
        createdBy: { select: { username: true } },
      },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  const formatted = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    location: e.location,
    status: e.status,
    result: e.result,
    isGiveaway: e.isGiveaway,
    attendeeCount: e._count.registrations,
    isRegistered: e.registrations.length > 0,
    createdByUsername: e.createdBy.username,
  }));

  return (
    <>
      <Topbar pageTitle="Events" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <EventsClient events={formatted} canManage={can(session!.user.rank, "canCreateEvent")} />
      </main>
    </>
  );
}
