// app/api/promotions/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { reviewPromotionRequestSchema } from "@/lib/validators/discipline";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canReviewPromotions")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = reviewPromotionRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.promotionRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  await prisma.$transaction([
    prisma.promotionRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionNote: parsed.data.rejectionNote,
      },
    }),
    prisma.notification.create({
      data: {
        userId: request.userId,
        type: "PROMOTION",
        title: "Promotion request declined",
        body: parsed.data.rejectionNote ?? "Your promotion request wasn't approved this time.",
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
