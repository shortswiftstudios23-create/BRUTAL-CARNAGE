// app/api/evidence/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createEvidenceSchema } from "@/lib/validators/content";

// Deputy+ only — same gate as viewing reports, since most evidence is
// filed as report proof. Regular members upload proof through the
// report form itself (which files it here automatically); this direct
// route covers ad-hoc evidence (raid footage, disputes, etc).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canViewReports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "video" | "image" | null (all)

  const files = await prisma.evidenceFile.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const uploaderIds = [...new Set(files.map((f) => f.uploadedById))];
  const uploaders = await prisma.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, username: true },
  });
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.username]));

  return NextResponse.json({
    files: files.map((f) => ({ ...f, uploadedBy: uploaderMap.get(f.uploadedById) ?? "Unknown" })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createEvidenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Anyone can file evidence they uploaded (e.g. via a report submission
  // or Uploadthing callback) — visibility on GET is still Deputy+ only.
  const file = await prisma.evidenceFile.create({
    data: {
      url: parsed.data.url,
      type: parsed.data.type,
      relatedReportId: parsed.data.relatedReportId,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ file }, { status: 201 });
}
