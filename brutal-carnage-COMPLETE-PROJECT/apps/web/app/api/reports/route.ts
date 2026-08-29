// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createReportSchema } from "@/lib/validators/discipline";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Reports are private to Deputy+ — including who filed them, per spec.
  if (!can(session.user.rank, "canViewReports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reportedBy: { select: { username: true } },
      reportedUser: { select: { username: true, rank: true } },
    },
  });

  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.reportedUserId === session.user.id) {
    return NextResponse.json({ error: "You can't report yourself" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      reportedById: session.user.id,
      reportedUserId: parsed.data.reportedUserId,
      statement: parsed.data.statement,
      videoProofUrl: parsed.data.videoProofUrl,
    },
  });

  // Also file the video link in the evidence locker so it's discoverable
  // there too, not just attached to this one report.
  await prisma.evidenceFile.create({
    data: {
      url: parsed.data.videoProofUrl,
      type: "video",
      relatedReportId: report.id,
      uploadedById: session.user.id,
    },
  });

  const reviewers = await prisma.user.findMany({
    where: { rank: { in: (["DEPUTY", "BOSS", "BIG_BOSS"] as const) } },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: reviewers.map((r) => ({
      userId: r.id,
      type: "SYSTEM" as const,
      title: "New report filed",
      body: "A new complaint with video proof has been submitted for review.",
    })),
  });

  return NextResponse.json({ report }, { status: 201 });
}
