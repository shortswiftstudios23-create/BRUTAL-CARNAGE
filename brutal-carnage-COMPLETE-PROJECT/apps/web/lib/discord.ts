// apps/web/lib/discord.ts
// Called from the website's promotion-approval API route. The web app
// doesn't hold a live Gateway connection, so it can't directly manipulate
// guild member roles the way the bot does — instead it calls the
// Discord REST API directly using the bot token (this works fine for
// one-off REST calls; only the *event listening* half needs the bot's
// persistent process).

import { RANK_TO_ROLE } from "./roleMap";
import { Rank } from "@prisma/client";
import { formatRankLabel } from "./rankLabels";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

// Removes every mapped rank role the member currently holds and adds
// only the new one, so a member never ends up holding two rank roles
// after a website-initiated promotion.
export async function syncDiscordRoleForPromotion(discordId: string, newRank: Rank) {
  const memberRes = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${discordId}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });

  if (!memberRes.ok) {
    throw new Error(`Failed to fetch Discord member ${discordId}: ${memberRes.status}`);
  }

  const member = await memberRes.json();
  const currentRoleIds: string[] = member.roles;
  const allRankRoleIds = Object.values(RANK_TO_ROLE);

  const rolesToKeep = currentRoleIds.filter((id) => !allRankRoleIds.includes(id));
  const newRoleSet = [...rolesToKeep, RANK_TO_ROLE[newRank]];

  const patchRes = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${discordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roles: newRoleSet }),
  });

  if (!patchRes.ok) {
    throw new Error(`Failed to update Discord roles for ${discordId}: ${patchRes.status}`);
  }
}

// Posted to the promotion-approvals channel once a request is approved
// and the Discord role swap above has already succeeded. Fixed pattern:
// tag the promoted member, then their previous rank, then their new
// rank, then tag whoever approved it.
const PROMOTION_APPROVED_CHANNEL_ID = "1542487057316712504";

export async function announcePromotionApproved({
  promotedGameId,
  promotedDiscordId,
  approvedByDiscordId,
  fromRank,
  toRank,
  reason,
}: {
  promotedGameId: string | null;
  promotedDiscordId: string;
  approvedByDiscordId: string;
  fromRank: Rank;
  toRank: Rank;
  reason: string;
}) {
  const content = [
    `**ID:** ${promotedGameId ?? "n/a"}`,
    `<@${promotedDiscordId}>`,
    `**Previous rank:** ${formatRankLabel(fromRank)}`,
    `**Promoted rank:** ${formatRankLabel(toRank)}`,
    `**Reason:** ${reason}`,
    `Promoted by: <@${approvedByDiscordId}>`,
  ].join("\n");

  const res = await fetch(`${DISCORD_API}/channels/${PROMOTION_APPROVED_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, allowed_mentions: { users: [promotedDiscordId, approvedByDiscordId] } }),
  });

  if (!res.ok) {
    throw new Error(`Failed to announce promotion approval: ${res.status}`);
  }
}

// Posted to the promotion-requests channel whenever a request is
// submitted from the website, so the same channel shows requests
// regardless of which side (website or Discord) they were filed from.
// (The reverse direction — someone typing the fixed template into this
// same channel — is handled by the bot's messageCreate listener, which
// writes the request straight into the DB.)
const PROMOTION_REQUEST_CHANNEL_ID = "1542487057782276167";

export async function postPromotionRequestToDiscord({
  gameId,
  discordId,
  fromRank,
  toRank,
  reason,
}: {
  // Requester's in-game ID from their website profile — resolved by the
  // caller (via the requester's User row, matched on Discord account),
  // never taken from free-typed text. Only shows "not set on profile"
  // in the rare case the member genuinely has no gameId saved yet —
  // it must never silently show "n/a" for a member who does have one.
  gameId: string | null;
  discordId: string;
  fromRank: Rank;
  toRank: Rank;
  reason: string;
}) {
  const content = [
    `**ID:** ${gameId ?? "not set on profile"}`,
    `**Current rank:** ${formatRankLabel(fromRank)}`,
    `**Requested rank:** ${formatRankLabel(toRank)}`,
    `**Reason:** ${reason}`,
    `<@${discordId}>`,
  ].join("\n");

  const res = await fetch(`${DISCORD_API}/channels/${PROMOTION_REQUEST_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, allowed_mentions: { users: [discordId] } }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post promotion request to Discord: ${res.status}`);
  }
}

// Posts a new event as an embed in the events channel and returns the
// message id, which we store on Event.discordMessageId. The bot's
// reminder cron (every 15 min, starting 30-60 min before startsAt) reads
// registrations fresh each tick and replies to this thread tagging only
// members currently registered — see bot/src/jobs/eventReminders.ts.
const EVENTS_CHANNEL_ID = process.env.DISCORD_EVENTS_CHANNEL_ID!;

export async function announceEvent(event: {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  location?: string | null;
  isGiveaway: boolean;
  eventType?: string | null;
  bonusAmount?: number | null;
}) {
  const unixTs = Math.floor(new Date(event.startsAt).getTime() / 1000);

  const { EVENT_TYPE_LABELS, EVENT_TYPE_PROOF_CHANNEL } = await import("./eventChannelMap");
  const proofChannelId = event.eventType
    ? EVENT_TYPE_PROOF_CHANNEL[event.eventType as keyof typeof EVENT_TYPE_PROOF_CHANNEL]
    : undefined;
  const proofNote = proofChannelId
    ? `📸 Send your event proof to <#${proofChannelId}>.`
    : undefined;

  const res = await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: proofNote,
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `${event.isGiveaway ? "🎁 Giveaway" : "📅 Event"}: ${event.title}`,
          description: event.description,
          color: 0xb91c1c,
          fields: [
            { name: "Starts", value: `<t:${unixTs}:F> (<t:${unixTs}:R>)`, inline: true },
            ...(event.location ? [{ name: "Location", value: event.location, inline: true }] : []),
            ...(event.eventType
              ? [{ name: "Type", value: EVENT_TYPE_LABELS[event.eventType as keyof typeof EVENT_TYPE_LABELS], inline: true }]
              : []),
            ...(event.bonusAmount
              ? [{ name: "Win bonus", value: `$${Number(event.bonusAmount).toLocaleString()}`, inline: true }]
              : []),
          ],
          footer: { text: "React or register on the website to be tagged in reminders." },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to announce event ${event.id}: ${res.status}`);
  }

  const message = await res.json();

  // Store the message id so reminders reply in-thread instead of
  // spamming a new message each time, and so the bot's reaction listener
  // (bot/src/events/messageReactionAdd.ts) can map a ✅ react back to
  // this event.
  const { prisma } = await import("./prisma");
  await prisma.event.update({
    where: { id: event.id },
    data: { discordMessageId: message.id },
  });

  // Pre-add the ✅ reaction ourselves so members can just click it
  // instead of typing one — this is the reaction the bot listens for to
  // register/unregister someone, keeping Discord and the website in sync
  // (previously the footer told people to "react" but nothing was
  // actually listening for it).
  await fetch(
    `${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages/${message.id}/reactions/%E2%9C%85/@me`,
    { method: "PUT", headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  ).catch((err) => console.error(`[announceEvent] failed to seed reaction for ${event.id}`, err));
}

// Posts a short in-thread notice that an event's details changed, so
// registered members don't miss an edited time/location.
export async function notifyEventUpdated(event: {
  id: string;
  title: string;
  discordMessageId: string | null;
}) {
  if (!event.discordMessageId) return;

  await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `✏️ **${event.title}** was updated by an event manager — check the details above.`,
      message_reference: { message_id: event.discordMessageId },
      allowed_mentions: { parse: [] },
    }),
  }).catch((err) => console.error("[notifyEventUpdated] failed", err));
}

// Opens (or reuses) a DM channel with the member and sends the strike
// notice privately — same private-DM pattern as the credential
// provisioning flow, so discipline never gets posted in a public channel.
export async function sendStrikeDM(discordId: string, severity: string, reason: string) {
  return sendDM(discordId, {
    embeds: [
      {
        title: `⚠️ Strike issued — ${severity}`,
        description: reason,
        color: 0xdc2626,
        footer: { text: "Brutal Carnage — Discipline notice" },
      },
    ],
  });
}

// Generic private-DM sender. Opens (or reuses) a DM channel with the
// member and posts a raw Discord message payload (content and/or embeds).
export async function sendDM(
  discordId: string,
  payload: { content?: string; embeds?: Record<string, unknown>[] }
) {
  const dmChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!dmChannelRes.ok) return false;

  const channel = await dmChannelRes.json();
  const sendRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return sendRes.ok;
}

// Notifies a member that a new private note was added about them: an
// in-app Notification (so it shows clearly in their notification bell)
// plus a Discord DM nudging them to check it. Never reveals note content
// over DM — private notes stay inside the website.
export async function notifyPrivateNoteAdded(
  aboutUserId: string,
  aboutUserDiscordId: string
) {
  const { prisma } = await import("./prisma");
  await prisma.notification.create({
    data: {
      userId: aboutUserId,
      type: "SYSTEM",
      title: "A note was added about you",
      body: "A private note was added to your profile by leadership. Check your notes on the Members page.",
    },
  });

  await sendDM(aboutUserDiscordId, {
    content: "📝 A private note was added about you. Check your notes on the website.",
  }).catch((err) => console.error("[notifyPrivateNoteAdded] DM failed", err));
}

// Posts a new announcement to all 3 of the family's fixed Discord
// channels (Public, Fam, Event) — previously announcements only ever
// generated an in-app notification and never actually reached Discord.
const ANNOUNCEMENT_CHANNEL_IDS = [
  "1542487056830308427", // Public
  "1542487057316712502", // Fam
  "1542487058235527283", // Event
];

export async function postAnnouncementToDiscord(announcement: {
  title: string;
  content: string;
  pinned: boolean;
  authorUsername?: string;
}) {
  const embed = {
    title: `${announcement.pinned ? "📌 " : "📣 "}${announcement.title}`,
    description: announcement.content.slice(0, 4000),
    color: 0xb91c1c,
    footer: announcement.authorUsername
      ? { text: `Posted by ${announcement.authorUsername}` }
      : undefined,
    timestamp: new Date().toISOString(),
  };

  const results = await Promise.allSettled(
    ANNOUNCEMENT_CHANNEL_IDS.map((channelId) =>
      fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Discord ${res.status} for channel ${channelId}`);
        return res;
      })
    )
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`[postAnnouncementToDiscord] ${failures.length}/${ANNOUNCEMENT_CHANNEL_IDS.length} channel posts failed`, failures);
  }

  return { succeeded: results.length - failures.length, failed: failures.length };
}
