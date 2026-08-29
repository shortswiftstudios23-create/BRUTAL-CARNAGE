// app/api/events/[id]/giveaway-draw/route.ts
// Picks one random winner from registered members for family-only
// giveaway events. Separate from the win/loss completion flow since a
// giveaway isn't a mission that can be "won or lost" — it's just a draw.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canMarkEventResult")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { registrations: { include: { user: { select: { id: true, username: true } } } } },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!event.isGiveaway) {
    return NextResponse.json({ error: "This event isn't marked as a giveaway" }, { status: 400 });
  }
  if (event.registrations.length === 0) {
    return NextResponse.json({ error: "No one is registered to draw from" }, { status: 409 });
  }

  const winner = event.registrations[Math.floor(Math.random() * event.registrations.length)].user;

  await prisma.$transaction([
    prisma.event.update({
      where: { id: event.id },
      data: { status: "COMPLETED", mvpUserId: winner.id }, // mvpUserId doubles as "winner" slot for giveaways
    }),
    prisma.notification.create({
      data: {
        userId: winner.id,
        type: "EVENT",
        title: "You won the giveaway! 🎉",
        body: `You were drawn as the winner of "${event.title}". Reach out to a Deputy+ to claim it.`,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "GIVEAWAY_DRAWN",
        metadata: { eventId: event.id, winnerId: winner.id },
      },
    }),
  ]);

  return NextResponse.json({ winner });
}
