// app/api/reimbursements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const owedOnly = searchParams.get("status") === "OWED";
  const canSeeAll = can(session.user.rank, "canApproveBankRequests");

  const reimbursements = await prisma.reimbursement.findMany({
    where: {
      userId: canSeeAll ? undefined : session.user.id,
      status: owedOnly ? "OWED" : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { username: true, rank: true } } },
  });

  return NextResponse.json({ reimbursements });
}
