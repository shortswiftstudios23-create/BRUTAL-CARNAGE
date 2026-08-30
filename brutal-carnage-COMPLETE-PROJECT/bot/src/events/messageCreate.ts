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
import { buildServerNickname } from "../lib/nickname";
import { RANK_TO_ROLE } from "../lib/roleMap";

export const name = Events.MessageCreate;

const PROMOTION_REQUEST_CHANNEL_ID = "1542487057782276167";
const ROLE_REQUEST_CHANNEL_ID = "1542488940882305096";

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
    if (message.author?.bot) return;
    if (
      message.channelId !== PROMOTION_REQUEST_CHANNEL_ID &&
      message.channelId !== ROLE_REQUEST_CHANNEL_ID
    ) {
      return;
    }
    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        console.error("[messageCreate] failed to fetch partial message", err);
        return;
      }
    }

    if (message.channelId === PROMOTION_REQUEST_CHANNEL_ID) {
      await handlePromotionRequest(message as Message);
    } else {
      await handleRoleRequest(message as Message);
    }
  } catch (err) {
    console.error("[messageCreate] failed to process message", err);
  }
}

async function handlePromotionRequest(message: Message) {
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

  // Post the canonical request format back into the channel — the
  // full reason text, and a mention of whoever submitted it (their
  // server nickname already shows their ID, so it isn't repeated
  // here as a separate field).
  const confirmation = [
    `<@${authorId}>`,
    `**Current rank:** ${formatRankLabel(member.rank)}`,
    `**Requested rank:** ${formatRankLabel(toRank)}`,
    `**Reason:** ${reasonField}`,
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
}

// ============================================================================
// ROLE REQUEST CHANNEL — first-time / self-service role claim
// ============================================================================
// Expected template (case-insensitive labels, order doesn't matter):
//   Name: Denver JIII
//   ID: 189119
//   Rank: 3 Cadet
//   Proof: <screenshot/link>
//
// "Rank" may be typed as "3 Cadet" (a leading number some servers use
// for tier ordering) or just "Cadet" — the leading number is stripped
// before matching against the real Rank enum. Unlike the promotion
// channel, this one DOES trust the typed ID/Name, because this is how
// a member's ID and in-game name get attached to their account in the
// first place — there's nothing in the DB yet to cross-check against.
function parseRoleRequestRank(input: string): string {
  return input.replace(/^\s*\d+\s*/, "").trim();
}

async function handleRoleRequest(message: Message) {
  const content = message.content ?? "";
  const nameField = parseField(content, "Name");
  const idField = parseField(content, "ID");
  const rankFieldRaw = parseField(content, "Rank");

  // Not a role-request-shaped message — leave it alone.
  if (!nameField || !idField || !rankFieldRaw) return;

  const rankLabel = parseRoleRequestRank(rankFieldRaw);
  const requestedRank = parseRankLabel(rankLabel);
  if (!requestedRank) {
    await message.reply(
      `Couldn't match "${rankFieldRaw}" to a real rank — check spelling and try again.`
    );
    return;
  }

  const authorId = message.author?.id;
  if (!authorId) return;

  const member = await prisma.user.findUnique({ where: { discordId: authorId } });
  if (!member) {
    await message.reply(
      "Couldn't find a website account for your Discord — join the server normally first so the bot can provision one."
    );
    return;
  }

  // A different member already claiming this exact ID would silently
  // steal their record — refuse instead.
  const idOwner = await prisma.user.findUnique({ where: { gameId: idField } });
  if (idOwner && idOwner.id !== member.id) {
    await message.reply(
      `That ID is already linked to another account. If this is a mistake, ask a Deputy+ to fix it manually.`
    );
    return;
  }

  await prisma.user.update({
    where: { id: member.id },
    data: { gameId: idField, gameName: nameField, rank: requestedRank },
  });

  const nick = buildServerNickname(requestedRank, nameField, idField);

  try {
    const guildMember = message.member ?? (await message.guild?.members.fetch(authorId));
    if (guildMember) {
      const allRankRoleIds = Object.values(RANK_TO_ROLE);
      const rolesToKeep = guildMember.roles.cache
        .filter((role) => !allRankRoleIds.includes(role.id))
        .map((role) => role.id);
      await guildMember.roles.set([...rolesToKeep, RANK_TO_ROLE[requestedRank]]);
      await guildMember.setNickname(nick).catch((err) =>
        console.error(`[messageCreate] couldn't set nickname for ${authorId} (missing permission or role hierarchy?)`, err)
      );
    }
  } catch (err) {
    console.error(`[messageCreate] failed to assign role for role-request from ${authorId}`, err);
    await message.reply(
      "Your details were saved, but I couldn't assign your Discord role automatically — ping a Deputy+ to sort out your role."
    );
    return;
  }

  await message.reply(
    `<@${authorId}> ✅ Role request approved — you're set as **${formatRankLabel(requestedRank)}** (\`${nick}\`).`
  );
}
