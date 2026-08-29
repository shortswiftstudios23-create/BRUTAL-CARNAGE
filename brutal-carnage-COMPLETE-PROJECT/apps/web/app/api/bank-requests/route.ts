// app/api/bank-requests/route.ts
// Members request money FROM the family balance with a reason. This is
// distinct from a WITHDRAWAL transaction: a bank request doesn't touch
// FamilyBalance until it's approved (see [id]/review/route.ts), and it
// carries a required reason so reviewers have context up front.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createBankRequestSchema } from "@/lib/validators/money";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createBankRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const request = await prisma.bankRequest.create({
    data: {
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      userId: session.user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";
  const pendingOnly = searchParams.get("status") === "PENDING";

  // Only Business Manager+ can see everyone else's requests — members
  // without approval rights only ever get their own, regardless of query params.
  const canSeeAll = can(session.user.rank, "canApproveBankRequests");

  const requests = await prisma.bankRequest.findMany({
    where: {
      userId: mine || !canSeeAll ? session.user.id : undefined,
      status: pendingOnly ? "PENDING" : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { username: true, rank: true } } },
  });

  return NextResponse.json({ requests });
}
