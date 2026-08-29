// app/api/performance/[userId]/summary/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getMemberStats, isInactive } from "@/lib/performance";
import { generatePerformanceSummary } from "@/lib/ai-summary";

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSelf = session.user.id === params.userId;
  if (!isSelf && !can(session.user.rank, "canViewDetailedLogs")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const stats = await getMemberStats(user.id);
  const daysSinceActive = Math.floor((Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));

  try {
    const summary = await generatePerformanceSummary({
      username: user.username,
      rank: user.rank,
      ...stats,
      daysSinceActive,
    });
    return NextResponse.json({ summary, isInactive: isInactive(user.lastActiveAt) });
  } catch {
    return NextResponse.json({ error: "Couldn't generate a summary right now" }, { status: 502 });
  }
}
