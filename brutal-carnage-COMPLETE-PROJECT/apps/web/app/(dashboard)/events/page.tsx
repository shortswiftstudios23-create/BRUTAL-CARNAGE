// app/(dashboard)/events/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EventsClient } from "./events-client";

// How long an already-started event stays visible to Event Manager+ (to
// mark attendance/result) before it drops off the list for everyone —
// while the row itself is NEVER deleted, so monthly/yearly win-loss and
// participation analytics always have the full history. See
// /events/records for the permanent, unfiltered view.
const MANAGER_VISIBILITY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export default async function EventsPage() {
  const session = await auth();
  const canSeeRecentlyStarted = can(session!.user.rank, "canViewEventAttendance");

  // Regular members: only ever see SCHEDULED events that haven't started
  // yet — the instant one starts, it's gone from their list (though the
  // row itself is never deleted, see MANAGER_VISIBILITY_WINDOW_MS above).
  // Event Manager+: also see anything that started within the last 3
  // days, regardless of status, so they can mark attendance/results
  // before it drops off.
  const now = new Date();
  const managerCutoff = new Date(now.getTime() - MANAGER_VISIBILITY_WINDOW_MS);
  const [events, unreadCount] = await Promise.all([
    prisma.event.findMany({
      where: canSeeRecentlyStarted
        ? {
            OR: [
              { startsAt: { gt: now } },
              { startsAt: { gte: managerCutoff, lte: now } },
            ],
          }
        : { status: "SCHEDULED", startsAt: { gt: now } },
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
    eventType: e.eventType,
    bonusAmount: e.bonusAmount ? Number(e.bonusAmount) : null,
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
