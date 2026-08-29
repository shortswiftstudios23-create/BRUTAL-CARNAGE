// app/api/cron/expire-events/route.ts
// Auto-transitions events from SCHEDULED to LIVE once their startsAt has
// passed. Combined with the events list filtering (SCHEDULED events past
// startsAt are excluded from "upcoming"), this is what makes an event
// "automatically get removed" from the website's upcoming list at its
// start time, while remaining visible under Live/close-out for managers
// to log a result. Call this on a schedule (every minute is fine) from
// the same scheduler used for /api/cron/accrue-loan-interest.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    new URL(req.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.event.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: new Date() } },
    data: { status: "LIVE" },
  });

  return NextResponse.json({ success: true, transitioned: result.count });
}
