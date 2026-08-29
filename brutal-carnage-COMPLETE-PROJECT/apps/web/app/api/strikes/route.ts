// app/api/strikes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createStrikeSchema } from "@/lib/validators/discipline";
import { sendStrikeDM } from "@/lib/discord";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canIssueStrike")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const strikes = await prisma.strike.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, rank: true } },
      issuedBy: { select: { username: true } },
    },
  });

  return NextResponse.json({ strikes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canIssueStrike")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createStrikeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const synced = await sendStrikeDM(target.discordId, parsed.data.severity, parsed.data.reason).catch(() => false);

  const strike = await prisma.strike.create({
    data: {
      userId: parsed.data.userId,
      issuedById: session.user.id,
      severity: parsed.data.severity,
      reason: parsed.data.reason,
      syncedToDiscord: synced,
    },
  });

  await prisma.notification.create({
    data: {
      userId: target.id,
      type: "STRIKE",
      title: `Strike issued — ${parsed.data.severity}`,
      body: parsed.data.reason,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "STRIKE_ISSUED",
      metadata: { targetUserId: target.id, severity: parsed.data.severity },
    },
  });

  return NextResponse.json({ strike }, { status: 201 });
}
