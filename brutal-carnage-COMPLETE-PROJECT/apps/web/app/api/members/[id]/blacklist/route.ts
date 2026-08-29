// app/api/members/[id]/blacklist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { setBlacklistSchema } from "@/lib/validators/discipline";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canManageBlacklist")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = setBlacklistSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: target.id },
    data: {
      isBlacklisted: parsed.data.blacklisted,
      blacklistReason: parsed.data.blacklisted ? parsed.data.reason : null,
    },
  });

  // Blacklisting immediately locks them out — auth.ts's signIn callback
  // checks isBlacklisted on every login attempt, so an active session's
  // next request still gets rejected via the JWT refresh.
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: parsed.data.blacklisted ? "MEMBER_BLACKLISTED" : "MEMBER_UNBLACKLISTED",
      metadata: { targetUserId: target.id, reason: parsed.data.reason },
    },
  });

  return NextResponse.json({ success: true });
}
