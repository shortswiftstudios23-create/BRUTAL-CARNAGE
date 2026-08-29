// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { updateEventSchema } from "@/lib/validators/events";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { registrations: true } },
      registrations: { include: { user: { select: { id: true, username: true } } } },
      createdBy: { select: { username: true } },
    },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  return NextResponse.json({ event });
}

// Lets an event manager edit an existing event's details (title,
// description, time, location, type, giveaway flag, bonus). Re-announces
// the change in-thread on Discord so registered members see what changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canCreateEvent")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.event.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.event.update({
    where: { id: params.id },
    data: parsed.data,
  });

  // Best-effort notice on Discord that details changed; doesn't fail the
  // request if Discord is unreachable.
  try {
    const { notifyEventUpdated } = await import("@/lib/discord");
    await notifyEventUpdated(event);
  } catch (err) {
    console.error("[events/PATCH] discord notify failed", err);
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "EVENT_UPDATED", metadata: { eventId: event.id } },
  });

  return NextResponse.json({ event });
}
