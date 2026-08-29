// app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validators/events";
import { announceEvent } from "@/lib/discord";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.event.findMany({
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
