// apps/web/lib/discord.ts
// Called from the website's promotion-approval API route. The web app
// doesn't hold a live Gateway connection, so it can't directly manipulate
// guild member roles the way the bot does — instead it calls the
// Discord REST API directly using the bot token (this works fine for
// one-off REST calls; only the *event listening* half needs the bot's
// persistent process).

import { RANK_TO_ROLE } from "./roleMap";
import { Rank } from "@prisma/client";

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
}) {
  const unixTs = Math.floor(new Date(event.startsAt).getTime() / 1000);

  const res = await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [
        {
          title: `${event.isGiveaway ? "🎁 Giveaway" : "📅 Event"}: ${event.title}`,
          description: event.description,
          color: 0xb91c1c,
          fields: [
            { name: "Starts", value: `<t:${unixTs}:F> (<t:${unixTs}:R>)`, inline: true },
            ...(event.location ? [{ name: "Location", value: event.location, inline: true }] : []),
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
  // spamming a new message each time.
  const { prisma } = await import("./prisma");
  await prisma.event.update({
    where: { id: event.id },
    data: { discordMessageId: message.id },
  });
}

// Opens (or reuses) a DM channel with the member and sends the strike
// notice privately — same private-DM pattern as the credential
// provisioning flow, so discipline never gets posted in a public channel.
export async function sendStrikeDM(discordId: string, severity: string, reason: string) {
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
    body: JSON.stringify({
      embeds: [
        {
          title: `⚠️ Strike issued — ${severity}`,
          description: reason,
          color: 0xdc2626,
          footer: { text: "Brutal Carnage — Discipline notice" },
        },
      ],
    }),
  });

  return sendRes.ok;
}
