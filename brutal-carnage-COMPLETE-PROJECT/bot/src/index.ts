// bot/src/index.ts
// Entry point. Run with `pm2 start dist/index.js --name brutal-carnage-bot`
// on the always-on VM (see the connection guide for full setup).

import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as http from "http";
import * as guildMemberAdd from "./events/guildMemberAdd";
import * as guildMemberUpdate from "./events/guildMemberUpdate";
import { startEventReminderJob } from "./jobs/eventReminder";
import { startWeeklySummaryJob } from "./jobs/weeklySummary";

// Render's free "Web Service" tier requires the process to bind to a
// port and respond to HTTP requests, or it considers the deploy failed.
// This tiny server exists ONLY to satisfy that requirement and to give
// an uptime-pinger (e.g. UptimeRobot) something to hit every few minutes
// so Render doesn't spin the service down from inactivity. It has
// nothing to do with the bot's actual Discord functionality.
const PORT = process.env.PORT || 3000;
http
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Brutal Carnage bot is running.");
  })
  .listen(PORT, () => {
    console.log(`[bot] Keep-alive server listening on port ${PORT}`);
  });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // required: member join/role-change events
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,     // required if you add message-based commands later
  ],
  partials: [Partials.GuildMember, Partials.User],
});

// ----------------------------------------------------------------------
// WHY THE BOT "GOES OFFLINE" WITH NOTHING IN THE LOGS
// ----------------------------------------------------------------------
// The HTTP keep-alive server above has NOTHING to do with the Discord
// gateway connection — it can happily keep responding "OK" to
// UptimeRobot forever even after the Discord WebSocket has silently
// died (Discord gateways get recycled / lose their session sometimes,
// and that doesn't always throw a loud "error" event). That's exactly
// why Render's logs look clean and the bot still shows as "down" in
// Discord: the Node process never crashed, so there was nothing to log
// or restart.
//
// Fix: track the last time we know for sure the gateway was alive
// (ready, resumed, or a heartbeat ack) and run a watchdog that checks
// it every 60s. If too much time has passed without a heartbeat, we
// deliberately kill the process. Render's process manager automatically
// restarts a service that exits, so this turns a silent, invisible
// hang into a quick, self-healing restart instead of the bot just
// sitting there disconnected for hours.
// ----------------------------------------------------------------------
let lastAlive = Date.now();
const WATCHDOG_TIMEOUT_MS = 3 * 60 * 1000; // no heartbeat for 3 min = presumed dead
const WATCHDOG_INTERVAL_MS = 60 * 1000;

function markAlive(reason: string) {
  lastAlive = Date.now();
  console.log(`[bot] heartbeat ok (${reason}) at ${new Date().toISOString()}`);
}

setInterval(() => {
  const staleFor = Date.now() - lastAlive;
  if (staleFor > WATCHDOG_TIMEOUT_MS) {
    console.error(
      `[bot] watchdog: no gateway heartbeat for ${Math.round(staleFor / 1000)}s — ` +
        `connection is likely dead even though the process is still running. Exiting so Render restarts it.`
    );
    // Exit non-zero so Render's process manager treats this as a crash
    // and restarts the service. Do NOT try to client.destroy()/login()
    // again in-process first — a wedged discord.js client can fail to
    // clean up its old socket, so a fresh process is the reliable fix.
    process.exit(1);
  } else {
    console.log(`[bot] watchdog: last heartbeat ${Math.round(staleFor / 1000)}s ago — ok`);
  }
}, WATCHDOG_INTERVAL_MS);

client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);
  markAlive("ready");
  startEventReminderJob(client);
  startWeeklySummaryJob(client);
});

// discord.js's own heartbeat ack is the most reliable signal that the
// gateway socket is actually alive (not just that the process is up).
client.on("raw", (packet: { op?: number }) => {
  if (packet?.op === 11 /* HEARTBEAT_ACK */) markAlive("heartbeat ack");
});
client.on("resumed", () => markAlive("resumed"));
client.on("shardReady", () => markAlive("shardReady"));

client.on(guildMemberAdd.name, guildMemberAdd.execute);
client.on(guildMemberUpdate.name, guildMemberUpdate.execute);

client.on("shardDisconnect", (event, shardId) => {
  console.warn(`[bot] shard ${shardId} disconnected (code ${event?.code}). discord.js will try to reconnect.`);
});
client.on("shardReconnecting", (shardId) => {
  console.warn(`[bot] shard ${shardId} reconnecting…`);
});
client.on("shardResume", (shardId) => {
  console.log(`[bot] shard ${shardId} resumed.`);
  markAlive("shardResume");
});
client.on("shardError", (err, shardId) => {
  console.error(`[bot] shard ${shardId} error:`, err);
});
// "Invalidated" means the session is gone for good (e.g. token reset,
// or too many reconnect attempts) — discord.js will NOT auto-recover
// from this on its own, so we exit deliberately and let Render restart
// the process for a clean re-login.
client.on("invalidated", () => {
  console.error("[bot] Session invalidated — exiting so Render restarts the process for a clean login.");
  process.exit(1);
});

client.on("error", (err) => console.error("[bot] Client error:", err));
process.on("unhandledRejection", (err) => console.error("[bot] Unhandled rejection:", err));
process.on("uncaughtException", (err) => {
  console.error("[bot] Uncaught exception — exiting so the process manager restarts cleanly:", err);
  process.exit(1);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[bot] Initial login failed:", err);
  process.exit(1);
});
