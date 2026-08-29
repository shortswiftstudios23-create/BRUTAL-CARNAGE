// bot/src/jobs/eventReminder.ts
// Runs every minute; each tick, finds events starting within the next
// 30-60 minutes and — for those — posts a reminder in-thread every 15
// minutes, tagging ONLY members currently registered (read fresh each
// tick, so a late cancellation drops someone from the next reminder
// automatically). One in-memory Set tracks which (eventId, reminderSlot)
// pairs have already fired this run, so a restart may re-send at most
// one reminder — acceptable, and simpler than persisting reminder state.

import { Client } from "discord.js";
import { prisma } from "../lib/prisma";

const DISCORD_API = "https://discord.com/api/v10";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const EVENTS_CHANNEL_ID = process.env.DISCORD_EVENTS_CHANNEL_ID!;

const REMINDER_WINDOW_START_MIN = 60; // start reminding up to 60 min out
const REMINDER_WINDOW_END_MIN = 30; // ...down to 30 min out
const REMINDER_INTERVAL_MIN = 15;
const TICK_MS = 60_000;

// "eventId:flooredMinutesUntilStart" — coarse enough that a 15-min
// cadence only fires once per slot even though the tick runs every minute.
const firedReminders = new Set<string>();

export function startEventReminderJob(_client: Client) {
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[eventReminder] tick failed", err);
    }
  }, TICK_MS);
  console.log("[eventReminder] job started (checks every minute)");
}

async function tick() {
  const now = Date.now();
  const windowStart = new Date(now + REMINDER_WINDOW_END_MIN * 60_000);
  const windowEnd = new Date(now + REMINDER_WINDOW_START_MIN * 60_000);

  const upcoming = await prisma.event.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: { gte: windowStart, lte: windowEnd },
      discordMessageId: { not: null },
    },
    include: {
      registrations: { include: { user: { select: { discordId: true, username: true } } } },
    },
  });

  for (const event of upcoming) {
    const minutesUntil = Math.floor((new Date(event.startsAt).getTime() - now) / 60_000);
    // Snap to the nearest 15-min slot (60, 45, 30) so we don't fire on
    // every off-by-one minute as the tick drifts.
    const slot = Math.round(minutesUntil / REMINDER_INTERVAL_MIN) * REMINDER_INTERVAL_MIN;
    const key = `${event.id}:${slot}`;
    if (firedReminders.has(key)) continue;
    if (![60, 45, 30].includes(slot)) continue;

    firedReminders.add(key);

    if (event.registrations.length === 0) continue; // nobody to tag

    const mentions = event.registrations.map((r) => `<@${r.user.discordId}>`).join(" ");

    await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `⏰ **${event.title}** starts in ~${slot} minutes. ${mentions}`,
        message_reference: { message_id: event.discordMessageId },
        allowed_mentions: { parse: [], users: event.registrations.map((r) => r.user.discordId) },
      }),
    }).catch((err) => console.error(`[eventReminder] failed to post reminder for ${event.id}`, err));
  }

  // Prevent unbounded growth across a long-running process.
  if (firedReminders.size > 5000) firedReminders.clear();
}
