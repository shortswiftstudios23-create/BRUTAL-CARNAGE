// app/api/performance/[userId]/detail/route.ts
// Boss+ ("admins" = Boss and Big Boss) drill-down: full itemized
// donation/withdrawal timeline, item actions, and event participation
// history for a single member. Separate from the AI-summary route,
// which only returns totals for the prompt — this returns row-level
// data for the UI table.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getMemberDetailedHistory } from "@/lib/performance";

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSelf = session.user.id === params.userId;
  if (!isSelf && !can(session.user.rank, "canViewMemberPerformanceDetail")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, username: true, rank: true, gameId: true, joinedFamilyAt: true },
  });
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const history = await getMemberDetailedHistory(user.id);

  return NextResponse.json({ user, history });
}
