// app/api/promotions/[id]/approve/route.ts
// When a Deputy+ approves a promotion request on the website, this:
//   1. Marks the request approved
//   2. Updates the member's rank in the DB
//   3. Pushes the role change to Discord so the two stay in sync
//   4. Writes an audit log entry + notification
// If the Discord push fails, the DB rank change is rolled back so the
// website and Discord never silently disagree.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canApprovePromotionTo } from "@/lib/permissions";
import { syncDiscordRoleForPromotion, announcePromotionApproved } from "@/lib/discord";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.rank, "canReviewPromotions")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const request = await prisma.promotionRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!request) {
    return NextResponse.json({ error: "Promotion request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
  }
  if (!canApprovePromotionTo(session.user.rank, request.toRank)) {
    return NextResponse.json(
      { error: "Your rank isn't high enough to approve a promotion to that rank." },
      { status: 403 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.promotionRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: request.userId },
        data: { rank: request.toRank },
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          type: "PROMOTION",
          title: "You've been promoted",
          body: `Congratulations — you've been promoted to ${request.toRank.replace(/_/g, " ")}.`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PROMOTION_APPROVED",
          metadata: { targetUserId: request.userId, from: request.fromRank, to: request.toRank },
        },
      });
    });

    // Push to Discord LAST, outside the DB transaction. If this throws,
    // we catch below and revert the DB rank so it never drifts from
    // Discord's actual role state.
    await syncDiscordRoleForPromotion(request.user.discordId, request.toRank);

    // Announce it in the promotion-approvals channel. Best-effort —
    // the role change and DB state are already committed at this point,
    // so a Discord post failure here shouldn't roll anything back.
    await announcePromotionApproved({
      promotedGameId: request.user.gameId,
      promotedDiscordId: request.user.discordId,
      approvedByDiscordId: session.user.discordId,
      fromRank: request.fromRank,
      toRank: request.toRank,
      reason: request.reason,
    }).catch((err) => console.error("[promotions] failed to announce approval", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Promotion approval failed, rolling back rank change:", err);

    await prisma.user.update({
      where: { id: request.userId },
      data: { rank: request.fromRank },
    });
    await prisma.promotionRequest.update({
      where: { id: request.id },
      data: { status: "PENDING", reviewedById: null, reviewedAt: null },
    });

    return NextResponse.json(
      { error: "Discord sync failed — promotion was not applied. Try again." },
      { status: 502 }
    );
  }
}
