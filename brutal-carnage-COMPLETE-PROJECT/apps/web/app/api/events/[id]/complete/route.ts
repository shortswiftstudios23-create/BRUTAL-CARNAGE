// app/api/events/[id]/complete/route.ts
// Single close-out action for an event: marks attendance, sets the result,
// and — only on a Win — credits the flat bonus to every attendee plus the
// MVP bonus on top for one of them. Everything happens in one DB
// transaction so partial payouts can never happen.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { completeEventSchema } from "@/lib/validators/events";
import { resolveExpenseFunding } from "@/lib/funding";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.rank, "canMarkEventResult")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status === "COMPLETED") {
    return NextResponse.json({ error: "Event already completed" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = completeEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { result, bonusAmount, mvpUserId, mvpBonusAmount, attendedUserIds, fundingSource, personalIntent, personalPayerId } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Mark who actually showed up, regardless of win/loss.
    await tx.eventRegistration.updateMany({
      where: { eventId: event.id },
      data: { attended: false },
    });
    if (attendedUserIds.length > 0) {
      await tx.eventRegistration.updateMany({
        where: { eventId: event.id, userId: { in: attendedUserIds } },
        data: { attended: true },
      });
    }

    await tx.event.update({
      where: { id: event.id },
      data: {
        status: "COMPLETED",
        result,
        mvpUserId: result === "WIN" ? mvpUserId : null,
        bonusAmount: result === "WIN" ? bonusAmount ?? null : null,
        mvpBonusAmount: result === "WIN" ? mvpBonusAmount ?? null : null,
      },
    });

    // Bonuses only ever fire on a Win, matching "bonus only on Win" —
    // each payout is its own approved FAMILY_BONUS transaction and moves
    // the balance immediately since it's an admin-issued payout, not a
    // member submission that needs a second approval step.
    if (result === "WIN" && bonusAmount && bonusAmount > 0) {
      for (const userId of attendedUserIds) {
        const isMvp = userId === mvpUserId;
        const amount = bonusAmount + (isMvp && mvpBonusAmount ? mvpBonusAmount : 0);

        await tx.transaction.create({
          data: {
            type: "FAMILY_BONUS",
            category: "FAMILY_BONUS",
            originalAmount: amount,
            taxAmount: 0,
            finalAmount: amount,
            note: isMvp ? `Event win bonus + MVP — ${event.title}` : `Event win bonus — ${event.title}`,
            userId,
            status: "APPROVED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
          },
        });

        await tx.notification.create({
          data: {
            userId,
            type: "EVENT",
            title: isMvp ? "MVP bonus awarded" : "Event bonus awarded",
            body: `You received $${amount.toLocaleString()} for "${event.title}".`,
          },
        });
      }

      const totalPayout = attendedUserIds.reduce(
        (sum, userId) => sum + bonusAmount + (userId === mvpUserId && mvpBonusAmount ? mvpBonusAmount : 0),
        0
      );

      // Where the bonus pool money actually came from — family balance
      // directly, or someone's personal account (as a donation or as an
      // amount the family now owes back). See lib/funding.ts.
      await resolveExpenseFunding(tx, {
        funding: { source: fundingSource, personalIntent },
        amount: totalPayout,
        userId: personalPayerId || session.user.id,
        approvedById: session.user.id,
        expenseLabel: `Event win bonus — ${event.title}`,
        refType: "EVENT_WIN_BONUS",
        refId: event.id,
      });
    } else {
      // Loss (or no bonus set) — still notify attendees the event closed.
      for (const userId of attendedUserIds) {
        await tx.notification.create({
          data: {
            userId,
            type: "EVENT",
            title: "Event closed",
            body: `"${event.title}" ended in a ${result === "WIN" ? "win" : "loss"}.`,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EVENT_COMPLETED",
        metadata: { eventId: event.id, result, attendedCount: attendedUserIds.length },
      },
    });
  });

  return NextResponse.json({ success: true });
}
