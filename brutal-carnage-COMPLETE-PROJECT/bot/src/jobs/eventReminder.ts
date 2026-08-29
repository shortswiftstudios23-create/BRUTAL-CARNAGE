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

// Reminders fire every 15 minutes from up to 2 hours out, plus two final
// close-in nudges at 5 minutes and 1 minute before start.
const REMINDER_WINDOW_START_MIN = 120; // start reminding up to 2h out
const REMINDER_INTERVAL_MIN = 15;
const FINAL_REMINDER_SLOTS = [5, 1]; // extra close-in reminders, in minutes
const REMINDER_SLOTS = Array.from(
  { length: Math.floor(REMINDER_WINDOW_START_MIN / REMINDER_INTERVAL_MIN) },
  (_, i) => REMINDER_WINDOW_START_MIN - i * REMINDER_INTERVAL_MIN
).concat(FINAL_REMINDER_SLOTS);
const TICK_MS = 30_000; // sub-minute tick so the 1-min slot doesn't get skipped

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
  const windowStart = new Date(now); // events happening any time from now...
  const windowEnd = new Date(now + REMINDER_WINDOW_START_MIN * 60_000); // ...to the furthest-out slot

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
    const minutesUntil = (new Date(event.startsAt).getTime() - now) / 60_000;

    // Find the nearest defined slot this tick has just crossed into
    // (within half a tick's worth of minutes), so each slot fires once
    // regardless of tick drift.
    const toleranceMin = (TICK_MS / 60_000) * 0.75;
    const slot = REMINDER_SLOTS.find((s) => Math.abs(minutesUntil - s) <= toleranceMin);
    if (slot === undefined) continue;

    const key = `${event.id}:${slot}`;
    if (firedReminders.has(key)) continue;
    firedReminders.add(key);

    if (event.registrations.length === 0) continue; // nobody to tag

    const mentions = event.registrations.map((r) => `<@${r.user.discordId}>`).join(" ");

    // Tag the correct proof-submission channel for this event's type, if set.
    const { EVENT_TYPE_PROOF_CHANNEL } = await import("../lib/eventChannelMap");
    const proofChannelId = event.eventType
      ? EVENT_TYPE_PROOF_CHANNEL[event.eventType as keyof typeof EVENT_TYPE_PROOF_CHANNEL]
      : undefined;
    const proofLine = proofChannelId ? ` Send your event proof to <#${proofChannelId}>.` : "";

    const urgency = slot <= 1 ? "🔴 STARTING NOW" : slot <= 5 ? "🟠 Almost time" : "⏰";
    const label = slot < 1 ? "less than a minute" : `~${slot} minute${slot === 1 ? "" : "s"}`;

    await fetch(`${DISCORD_API}/channels/${EVENTS_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${urgency} **${event.title}** starts in ${label}.${proofLine} ${mentions}`,
        message_reference: { message_id: event.discordMessageId },
        allowed_mentions: { parse: [], users: event.registrations.map((r) => r.user.discordId) },
      }),
    }).catch((err) => console.error(`[eventReminder] failed to post reminder for ${event.id}`, err));
  }

  // Prevent unbounded growth across a long-running process.
  if (firedReminders.size > 5000) firedReminders.clear();
}
