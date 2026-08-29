// app/api/dashboard/widgets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { saveWidgetPrefsSchema } from "@/lib/validators/content";
import { reconcileWidgetPrefs, defaultWidgetPrefs, WidgetPref } from "@/lib/widgets";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dashboardWidgets: true },
  });

  // Fall back chain: personal prefs → family default template → hardcoded default.
  if (user?.dashboardWidgets) {
    return NextResponse.json({ widgets: reconcileWidgetPrefs(user.dashboardWidgets as unknown as WidgetPref[]) });
  }

  const template = await prisma.dashboardWidgetTemplate.findUnique({ where: { id: "default" } });
  if (template) {
    return NextResponse.json({ widgets: reconcileWidgetPrefs(template.widgets as unknown as WidgetPref[]) });
  }

  return NextResponse.json({ widgets: defaultWidgetPrefs() });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = saveWidgetPrefsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.setAsFamilyDefault) {
    if (!can(session.user.rank, "canManageAdminWidgets")) {
      return NextResponse.json({ error: "Forbidden — Boss+ only" }, { status: 403 });
    }
    await prisma.dashboardWidgetTemplate.upsert({
      where: { id: "default" },
      create: { id: "default", widgets: parsed.data.widgets },
      update: { widgets: parsed.data.widgets },
    });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dashboardWidgets: parsed.data.widgets },
  });

  return NextResponse.json({ widgets: parsed.data.widgets });
}
