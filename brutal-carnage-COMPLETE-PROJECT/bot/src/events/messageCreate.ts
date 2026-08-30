// bot/src/events/messageCreate.ts
// Lets a promotion request be typed directly into the
// #promotion-requests Discord channel using the family's fixed
// template, instead of only through the website form. Whichever side a
// request is created on, the other side gets the same record, so the
// log never depends on where someone happened to post.
//
// Expected template (case-insensitive labels, order doesn't matter):
//   Name: @UD│Deadly Ocean│255904
//   ID: 255904
//   Prev Rank: Deputy
//   Requested Rank: Boss
//   Reason: Why you think you deserve the promotion.
//
// The "Name" line is decorative (Discord already shows who posted it) —
// what actually identifies the member is the "ID" line, matched against
// User.gameId. "Prev Rank" as typed is just a sanity check; the
// member's real current rank (from the DB) is always used as the
// source of truth for fromRank.

import { Events, Message, PartialMessage } from "discord.js";
import { prisma } from "../lib/prisma";
import { parseRankLabel, formatRankLabel } from "../lib/rankLabels";

export const name = Events.MessageCreate;

const PROMOTION_REQUEST_CHANNEL_ID = "1542487057782276167";

function parseField(content: string, label: string): string | null {
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

export async function execute(message: Message | PartialMessage) {
  try {
    if (message.channelId !== PROMOTION_REQUEST_CHANNEL_ID) return;
    if (message.author?.bot) return;
    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        console.error("[messageCreate] failed to fetch partial message", err);
        return;
      }
    }

    const content = message.content ?? "";
    const idField = parseField(content, "ID");
    const requestedRankField = parseField(content, "Requested Rank");
    const reasonField = parseField(content, "Reason");

    // Not a promotion-request-shaped message — leave it alone (people
    // also chat in this channel).
    if (!idField || !requestedRankField || !reasonField) return;

    const toRank = parseRankLabel(requestedRankField);
    if (!toRank) {
      await message.reply(
        `Couldn't match "${requestedRankField}" to a real rank — check spelling and try again.`
      );
      return;
    }

    const member = await prisma.user.findUnique({ where: { gameId: idField } });
    if (!member) {
      await message.reply(
        `Couldn't find a member with ID \`${idField}\` on the website — make sure your account's game ID is set.`
      );
      return;
    }

    const existingPending = await prisma.promotionRequest.findFirst({
      where: { userId: member.id, status: "PENDING" },
    });
    if (existingPending) {
      await message.reply("You already have a pending promotion request — wait for that one to be reviewed.");
      return;
    }

    const request = await prisma.promotionRequest.create({
      data: {
        userId: member.id,
        fromRank: member.rank,
        toRank,
        reason: reasonField,
        statsSnapshot: {},
        discordMessageId: message.id,
      },
    });

    await message.reply(
      `✅ Promotion request logged — ${formatRankLabel(member.rank)} → ${formatRankLabel(toRank)}. Synced to the website for review.`
    );

    const reviewers = await prisma.user.findMany({
      where: {
        rank: { in: ["UNDER_DEPUTY", "DEPUTY", "BOSS", "BIG_BOSS"] },
      },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: reviewers.map((r) => ({
        userId: r.id,
        type: "PROMOTION" as const,
        title: "New promotion request (via Discord)",
        body: `${member.username} requested promotion to ${formatRankLabel(toRank)}.`,
      })),
    });

    void request;
  } catch (err) {
    console.error("[messageCreate] failed to process promotion request", err);
  }
}
