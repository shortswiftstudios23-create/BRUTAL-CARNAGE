// app/api/announcements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createAnnouncementSchema } from "@/lib/validators/content";

// Every member can read — pinned first, then newest first — so this is
// the family notice board, not a restricted feature.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  const authorIds = [...new Set(announcements.map((a) => a.createdById))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, username: true, rank: true },
  });
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return NextResponse.json({
    announcements: announcements.map((a) => ({
      ...a,
      author: authorMap.get(a.createdById) ?? null,
    })),
  });
}

// Boss+ only — matches PERMISSIONS.canManageAnnouncements.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canManageAnnouncements")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const announcement = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      pinned: parsed.data.pinned,
      createdById: session.user.id,
    },
  });

  // Fan out to the family's 3 fixed Discord channels (Public/Fam/Event).
  // Best-effort — a Discord outage shouldn't block the announcement from
  // existing on the website.
  try {
    const { postAnnouncementToDiscord } = await import("@/lib/discord");
    await postAnnouncementToDiscord({
      title: parsed.data.title,
      content: parsed.data.content,
      pinned: parsed.data.pinned,
      authorUsername: session.user.name ?? undefined,
    });
  } catch (err) {
    console.error("[announcements/POST] Discord post failed", err);
  }

  // Fan out an in-app notification to every non-blacklisted member so the
  // notification bell actually surfaces new announcements, not just the
  // board page.
  const members = await prisma.user.findMany({
    where: { isBlacklisted: false },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.id,
      type: "ANNOUNCEMENT" as const,
      title: parsed.data.pinned ? `📌 ${parsed.data.title}` : parsed.data.title,
      body: parsed.data.content.slice(0, 200),
    })),
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "ANNOUNCEMENT_CREATED", metadata: { announcementId: announcement.id } },
  });

  return NextResponse.json({ announcement }, { status: 201 });
}
