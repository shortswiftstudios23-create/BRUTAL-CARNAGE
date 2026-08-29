// app/api/reports/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reviewReportSchema } from "@/lib/validators/discipline";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canViewReports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reviewReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: { status: parsed.data.approve ? "APPROVED" : "REJECTED" },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: parsed.data.approve ? "REPORT_SUBSTANTIATED" : "REPORT_DISMISSED",
        metadata: { reportId: report.id, note: parsed.data.resolutionNote },
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
