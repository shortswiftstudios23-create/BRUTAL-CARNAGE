// app/api/admin/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { updateCategorySchema } from "@/lib/validators/category";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canManageCategories")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await prisma.transactionCategory.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      group: parsed.data.group === "" ? null : parsed.data.group,
      icon: parsed.data.icon === "" ? null : parsed.data.icon,
    },
  });

  return NextResponse.json({ category });
}

// Hard-delete — only allowed when nothing references this category yet.
// Anything with history should be deactivated (PATCH isActive:false)
// instead, so past transactions never lose their label.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canManageCategories")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const usageCount = await prisma.transaction.count({
    where: { customCategoryId: params.id },
  });

  if (usageCount > 0) {
    return NextResponse.json(
      {
        error: `This category is used on ${usageCount} transaction${usageCount === 1 ? "" : "s"}. Deactivate it instead of deleting.`,
      },
      { status: 409 }
    );
  }

  await prisma.transactionCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
