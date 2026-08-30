// app/api/promotions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, RANK_ORDER, rankLevel } from "@/lib/permissions";
import { createPromotionRequestSchema } from "@/lib/validators/discipline";
import { getMemberStats } from "@/lib/performance";
import { postPromotionRequestToDiscord } from "@/lib/discord";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canReview = can(session.user.rank, "canReviewPromotions");

  const requests = await prisma.promotionRequest.findMany({
    where: canReview ? {} : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true, rank: true, discordAvatar: true } } },
  });

  return NextResponse.json({ requests, canReview });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canSubmitPromotionRequest")) {
    return NextResponse.json({ error: "You're not yet eligible to request a promotion" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPromotionRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const currentLevel = rankLevel(session.user.rank);
  const targetLevel = rankLevel(parsed.data.toRank);
  if (targetLevel !== currentLevel + 1) {
    return NextResponse.json(
      { error: `You can only request the next rank up: ${RANK_ORDER[currentLevel + 1]?.replace(/_/g, " ") ?? "n/a"}` },
      { status: 400 }
    );
  }

  const existingPending = await prisma.promotionRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json({ error: "You already have a pending promotion request" }, { status: 409 });
  }

  // Snapshot real stats at submission time so reviewers see the exact
  // numbers the request was judged against, even if activity changes
  // (or the member goes quiet) before it's reviewed.
  const statsSnapshot = await getMemberStats(session.user.id);

  const request = await prisma.promotionRequest.create({
    data: {
      userId: session.user.id,
      fromRank: session.user.rank,
      toRank: parsed.data.toRank,
      reason: parsed.data.reason,
      statsSnapshot,
    },
  });

  // Mirror it to Discord in the family's fixed template. Best-effort —
  // if Discord is unreachable the request still exists on the website
  // and can be approved from there; we just log it.
  try {
    const requester = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { gameId: true },
    });
    const discordMessageId = await postPromotionRequestToDiscord({
      discordId: session.user.discordId,
      gameId: requester?.gameId ?? null,
      fromRank: session.user.rank,
      toRank: parsed.data.toRank,
      reason: parsed.data.reason,
    });
    await prisma.promotionRequest.update({
      where: { id: request.id },
      data: { discordMessageId },
    });
  } catch (err) {
    console.error("[promotions] failed to mirror request to Discord:", err);
  }

  // Notify everyone who can review it.
  const reviewers = await prisma.user.findMany({
    where: { rank: { in: RANK_ORDER.filter((r) => can(r, "canReviewPromotions")) } },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: reviewers.map((r) => ({
      userId: r.id,
      type: "PROMOTION" as const,
      title: "New promotion request",
      body: `${session.user.name} requested promotion to ${parsed.data.toRank.replace(/_/g, " ")}.`,
    })),
  });

  return NextResponse.json({ request }, { status: 201 });
}
