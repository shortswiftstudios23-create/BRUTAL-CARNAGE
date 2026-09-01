// app/api/admin/categories/route.ts
// Admin-managed transaction categories layered on top of the fixed
// TransactionType enum (see prisma/schema.prisma TransactionCategory).
// GET is available to anyone signed in (forms need the active list to
// populate dropdowns); only Boss+ can create new categories.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createCategorySchema } from "@/lib/validators/category";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  // Default to active-only (what every "new transaction" dropdown wants).
  // The admin page itself passes includeInactive=true to see everything.
  const includeInactive = searchParams.get("includeInactive") === "true";

  const categories = await prisma.transactionCategory.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canManageCategories")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.transactionCategory.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A category with that name already exists." },
      { status: 409 }
    );
  }

  // New categories land at the end of their group by default; admins can
  // drag-reorder afterward (PATCH sortOrder).
  const maxSort = await prisma.transactionCategory.aggregate({
    where: { group: parsed.data.group || null },
    _max: { sortOrder: true },
  });

  const category = await prisma.transactionCategory.create({
    data: {
      name: parsed.data.name,
      direction: parsed.data.direction,
      group: parsed.data.group || null,
      icon: parsed.data.icon || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
