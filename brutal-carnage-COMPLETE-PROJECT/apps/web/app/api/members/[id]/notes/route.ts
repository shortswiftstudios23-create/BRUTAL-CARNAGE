// app/api/members/[id]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createPrivateNoteSchema } from "@/lib/validators/discipline";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canViewPrivateNotes")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notes = await prisma.privateNote.findMany({
    where: { aboutUserId: params.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { username: true } } },
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canViewPrivateNotes")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPrivateNoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const note = await prisma.privateNote.create({
    data: { aboutUserId: params.id, authorId: session.user.id, content: parsed.data.content },
  });

  return NextResponse.json({ note }, { status: 201 });
}
