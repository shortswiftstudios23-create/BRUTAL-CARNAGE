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
// The "Name" line is decorative (Discord already shows who posted it),
// and the typed "ID" line is a courtesy only — the member is actually
// identified by the Discord account that posted the message (matched
// against User.discordId), so a mistyped or spoofed ID can't misfile
// the request. "Prev Rank" as typed is likewise just a sanity check;
// the member's real current rank (from the DB) is always used as the
// source of truth for fromRank.

import { Events, Message, PartialMessage } from "discord.js";
import { prisma } from "../lib/prisma";
import { parseRankLabel, formatRankLabel } from "../lib/rankLabels";

export const name = Events.MessageCreate;

const PROMOTION_REQUEST_CHANNEL_ID = "1542487057782276167";

// Matches "Label: value" through to the end of the line. Used for
// short single-line fields (rank labels, the optional typed ID).
function parseField(content: string, label: string): string | null {
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

// The list of labels the template can contain, in the order they're
// checked as "where does this field's value end". Reason is always
// last in the template, but people don't always follow that — this
// still finds whichever known label comes next (if any) so a
// multi-line reason isn't cut off at the first newline the way a
// single-line regex would cut it off.
const KNOWN_LABELS = ["Name", "ID", "Prev Rank", "Current Rank", "Requested Rank", "Reason"];

// Captures everything after "Reason:" up to the next known label (or
// the end of the message), across as many lines as the person wrote —
// so a long, multi-paragraph reason is captured in full instead of
// being truncated to its first line.
function parseReasonField(content: string): string | null {
  const startMatch = content.match(/^\s*Reason\s*:\s*/im);
  if (!startMatch || startMatch.index === undefined) return null;

  const afterLabel = content.slice(startMatch.index + startMatch[0].length);
  const otherLabels = KNOWN_LABELS.filter((l) => l.toLowerCase() !== "reason");
  const nextLabelRe = new RegExp(`\\n\\s*(?:${otherLabels.join("|")})\\s*:`, "i");
  const nextLabelMatch = afterLabel.match(nextLabelRe);

  const raw = nextLabelMatch ? afterLabel.slice(0, nextLabelMatch.index) : afterLabel;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    const requestedRankField = parseField(content, "Requested Rank");
    const reasonField = parseReasonField(content);

    // Not a promotion-request-shaped message — leave it alone (people
    // also chat in this channel).
    if (!requestedRankField || !reasonField) return;

    const toRank = parseRankLabel(requestedRankField);
    if (!toRank) {
      await message.reply(
        `Couldn't match "${requestedRankField}" to a real rank — check spelling and try again.`
      );
      return;
    }

    // The member is identified by the Discord account that actually
    // posted the message, never by an "ID:" line they typed — that
    // typed line is decorative only, so it can't be spoofed or
    // mistyped into pulling up the wrong profile.
    const authorId = message.author?.id;
    if (!authorId) return;

    const member = await prisma.user.findUnique({ where: { discordId: authorId } });
    if (!member) {
      await message.reply(
        `Couldn't find a website account linked to your Discord — make sure you've logged in on the site at least once.`
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

    // Post the canonical request format back into the channel — ID
    // always pulled from the member's website profile (never n/a
    // unless they genuinely haven't set one), the full reason text,
    // and a mention of whoever submitted it.
    const confirmation = [
      `**ID:** ${member.gameId ?? "not set on profile"}`,
      `**Current rank:** ${formatRankLabel(member.rank)}`,
      `**Requested rank:** ${formatRankLabel(toRank)}`,
      `**Reason:** ${reasonField}`,
      `<@${authorId}>`,
    ].join("\n");
    await message.reply({ content: confirmation, allowedMentions: { users: [authorId] } });

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
