// app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validators/events";
import { announceEvent } from "@/lib/discord";

// How long a started event stays visible to Event Manager+ after it
// begins — enough time to mark attendance and close it out. Regular
// members never see it past its start time at all: to them it "deletes
// itself" the moment startsAt passes, per the rule. Nothing is ever
// actually deleted from the database — this only controls what the
// events LIST returns; the rows themselves (and every registration /
// attendance flag on them) live forever for monthly/yearly analysis via
// the performance pages, which query the database directly and ignore
// this visibility window entirely.
const MANAGER_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const canSeePastWindow = can(session.user.rank, "canViewEventAttendance");

  const events = await prisma.event.findMany({
    where: canSeePastWindow
      ? // Event Manager+: anything upcoming, plus anything that started
        // within the last 3 days (so attendance can still be marked).
        { OR: [{ startsAt: { gt: now } }, { startsAt: { gte: new Date(now.getTime() - MANAGER_RETENTION_MS) } }] }
      : // Everyone else: only events that haven't started yet. The instant
        // startsAt passes, it drops off their list entirely — the record
        // still exists, it's just not returned here.
        { startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        where: { userId: session.user.id },
        select: { id: true, attended: true },
      },
      createdBy: { select: { username: true, discordAvatar: true } },
    },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canCreateEvent")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: parsed.data.startsAt,
      location: parsed.data.location,
      isGiveaway: parsed.data.isGiveaway,
      eventType: parsed.data.eventType,
      bonusAmount: parsed.data.bonusAmount,
      createdById: session.user.id,
    },
  });

  // Fire-and-forget: posts the announcement embed to the events channel and
  // stores the returned message id so the bot's reminder job (every 15 min,
  // starting 30-60 min before start) can edit/reply on the same message and
  // knows exactly who to @-tag by re-reading registrations at send time.
  announceEvent(event).catch((err) => console.error("Discord announce failed:", err));

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "EVENT_CREATED", metadata: { eventId: event.id } },
  });

  return NextResponse.json({ event }, { status: 201 });
}
