// app/api/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { saveRulesSchema } from "@/lib/validators/content";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.rule.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ rules });
}

// Boss+ replaces the whole rulebook in one save — simpler and safer than
// per-row PATCH/DELETE for a small, infrequently-edited list, and lets the
// editor freely reorder/add/remove rows before committing.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canManageAnnouncements")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = saveRulesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rules = await prisma.$transaction(async (tx) => {
    await tx.rule.deleteMany({});
    if (parsed.data.rules.length === 0) return [];
    await tx.rule.createMany({
      data: parsed.data.rules.map((r) => ({
        order: r.order,
        title: r.title,
        content: r.content,
      })),
    });
    return tx.rule.findMany({ orderBy: { order: "asc" } });
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "RULES_UPDATED", metadata: { count: rules.length } },
  });

  return NextResponse.json({ rules });
}
