// app/(dashboard)/promotions/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, RANK_ORDER, rankLevel } from "@/lib/permissions";
import { PromotionsClient } from "./promotions-client";

export default async function PromotionsPage() {
  const session = await auth();
  const canReview = can(session!.user.rank, "canReviewPromotions");

  const [requests, unreadCount] = await Promise.all([
    prisma.promotionRequest.findMany({
      where: canReview ? {} : { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true, rank: true } } },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  const currentLevel = rankLevel(session!.user.rank);
  // Any rank above the member's current one is a valid request target —
  // not just the immediate next step.
  const eligibleRanks = RANK_ORDER.slice(currentLevel + 1);

  return (
    <>
      <Topbar pageTitle="Promotions" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <PromotionsClient
          requests={requests.map((r) => ({
            id: r.id,
            username: r.user.username,
            fromRank: r.fromRank,
            toRank: r.toRank,
            status: r.status,
            statsSnapshot: r.statsSnapshot as Record<string, unknown>,
            createdAt: r.createdAt.toISOString(),
            isOwn: r.userId === session!.user.id,
          }))}
          canReview={canReview}
          canRequest={can(session!.user.rank, "canSubmitPromotionRequest")}
          eligibleRanks={eligibleRanks}
        />
      </main>
    </>
  );
}
