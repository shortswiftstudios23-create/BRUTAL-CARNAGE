// app/api/events/[id]/register/route.ts
// One-click registration. POST toggles: registers if not yet registered,
// unregisters if already registered — the UI just calls the same endpoint
// for both, matching "one-click registration" from the spec.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status === "COMPLETED" || event.status === "CANCELLED") {
    return NextResponse.json({ error: "This event is no longer open for registration" }, { status: 409 });
  }

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.eventRegistration.delete({ where: { id: existing.id } });
    return NextResponse.json({ registered: false });
  }

  await prisma.eventRegistration.create({
    data: { eventId: event.id, userId: session.user.id },
  });

  return NextResponse.json({ registered: true });
}
