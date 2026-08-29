// bot/src/jobs/weeklySummary.ts
// Posts a "here's what happened this week" embed to Discord on a fixed
// schedule. Lives in the bot (not a Vercel cron hitting the web app)
// because the bot already holds the persistent connection and REST
// helpers this needs, and because "automatic weekly summary" is framed
// in the spec as something the family sees show up in Discord on its
// own — no external trigger required once the bot is running.

import { Client } from "discord.js";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";

const DISCORD_API = "https://discord.com/api/v10";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const SUMMARY_CHANNEL_ID = process.env.DISCORD_WEEKLY_SUMMARY_CHANNEL_ID!;

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly, fire once/week
const TARGET_DAY = 1; // Monday (0 = Sunday)
const TARGET_HOUR = 9; // 9am server time

export function startWeeklySummaryJob(_client: Client) {
  setInterval(async () => {
    try {
      await maybeRun();
    } catch (err) {
      console.error("[weeklySummary] tick failed", err);
    }
  }, CHECK_INTERVAL_MS);
  console.log("[weeklySummary] job started (checks hourly, fires Mondays 9am)");
}

async function maybeRun() {
  const now = new Date();
  if (now.getDay() !== TARGET_DAY || now.getHours() !== TARGET_HOUR) return;

  // Guard against firing twice in the same hour if the process restarts,
  // and against re-sending if a previous run already covered this week —
  // stamped via an AuditLog row rather than a dedicated table, since this
  // is a once-a-week, low-volume marker.
  const weekKey = isoWeekKey(now);
  const alreadySent = await prisma.auditLog.findFirst({
    where: { action: "WEEKLY_DIGEST_SENT", metadata: { equals: { weekKey } } },
  });
  if (alreadySent) return;

  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  await postDigest(since, now);
  await logAudit(null, "WEEKLY_DIGEST_SENT", { weekKey });
}

async function postDigest(since: Date, until: Date) {
  const [donations, withdrawals, newMembers, eventsCompleted, strikesIssued, topDonor, balance] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { type: "DONATION", status: "APPROVED", createdAt: { gte: since, lt: until } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "APPROVED", createdAt: { gte: since, lt: until } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.user.count({ where: { joinedFamilyAt: { gte: since, lt: until } } }),
      prisma.event.count({ where: { status: "COMPLETED", startsAt: { gte: since, lt: until } } }),
      prisma.strike.count({ where: { createdAt: { gte: since, lt: until } } }),
      prisma.transaction.groupBy({
        by: ["userId"],
        where: { type: "DONATION", status: "APPROVED", createdAt: { gte: since, lt: until } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 1,
      }),
      prisma.familyBalance.findUnique({ where: { id: "singleton" } }),
    ]);

  const topDonorUser = topDonor[0]
    ? await prisma.user.findUnique({ where: { id: topDonor[0].userId }, select: { username: true } })
    : null;

  const fields = [
    { name: "💰 Family balance", value: `$${Number(balance?.balance ?? 0).toLocaleString()}`, inline: true },
    {
      name: "📥 Donations",
      value: `$${Number(donations._sum.amount ?? 0).toLocaleString()} (${donations._count})`,
      inline: true,
    },
    {
      name: "📤 Withdrawals",
      value: `$${Number(withdrawals._sum.amount ?? 0).toLocaleString()} (${withdrawals._count})`,
      inline: true,
    },
    { name: "🆕 New members", value: String(newMembers), inline: true },
    { name: "🏁 Events completed", value: String(eventsCompleted), inline: true },
    { name: "⚠️ Strikes issued", value: String(strikesIssued), inline: true },
    ...(topDonorUser
      ? [
          {
            name: "🏆 Top donor this week",
            value: `${topDonorUser.username} — $${Number(topDonor[0]._sum.amount ?? 0).toLocaleString()}`,
            inline: false,
          },
        ]
      : []),
  ];

  const res = await fetch(`${DISCORD_API}/channels/${SUMMARY_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "📊 Brutal Carnage — Weekly Summary",
          description: `${since.toLocaleDateString()} → ${until.toLocaleDateString()}`,
          color: 0xb91c1c,
          fields,
          footer: { text: "Posted automatically every Monday. Full detail on the dashboard." },
          timestamp: until.toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`[weeklySummary] failed to post digest: ${res.status} ${await res.text()}`);
  }
}

// ISO 8601 week identifier (e.g. "2026-W35") so re-runs within the same
// week are recognized as duplicates regardless of what hour they check in.
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
