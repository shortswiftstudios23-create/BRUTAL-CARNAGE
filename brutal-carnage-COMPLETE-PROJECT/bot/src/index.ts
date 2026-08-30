// bot/src/index.ts
// Entry point. Run with `pm2 start dist/index.js --name brutal-carnage-bot`
// on the always-on VM (see the connection guide for full setup).

import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as http from "http";
import * as guildMemberAdd from "./events/guildMemberAdd";
import * as guildMemberUpdate from "./events/guildMemberUpdate";
import * as messageReactionAdd from "./events/messageReactionAdd";
import * as messageReactionRemove from "./events/messageReactionRemove";
import * as messageCreate from "./events/messageCreate";
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
    GatewayIntentBits.GuildMessageReactions, // required: ✅ react = event registration
  ],
  // Message/Reaction/User partials are required so reactionAdd/Remove
  // still fires for messages the bot hasn't cached (e.g. after a
  // restart) — without these, reacting to an older event announcement
  // silently does nothing.
  partials: [Partials.GuildMember, Partials.User, Partials.Message, Partials.Reaction],
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
// Fix: run an ACTIVE health check — actually make a real request to
// Discord's API every interval — instead of passively waiting for an
// internal gateway event. (An earlier version of this watchdog listened
// for heartbeat-ack packets via the "raw" client event, but discord.js
// only re-emits "raw" for real dispatch events like messages or member
// updates, not internal gateway opcodes like heartbeat acks — so on a
// quiet server it never fired, and the watchdog killed a perfectly
// healthy bot every few minutes. An active REST call sidesteps that
// entirely: if it succeeds, we know for a fact the connection is good.)
// If several checks in a row fail or time out, we deliberately kill the
// process. Render's process manager automatically restarts a service
// that exits, so this turns a silent, invisible hang into a quick,
// self-healing restart instead of the bot sitting there disconnected.
// ----------------------------------------------------------------------
const WATCHDOG_INTERVAL_MS = 90 * 1000; // check every 90s
const HEALTH_CHECK_TIMEOUT_MS = 15 * 1000; // give Discord's API 15s to answer
const MAX_CONSECUTIVE_FAILURES = 3; // ~4.5 min of real, repeated failures before restarting

let consecutiveFailures = 0;
let watchdogStarted = false;

async function activeHealthCheck() {
  try {
    await Promise.race([
      // Lightweight authenticated REST call — if this succeeds, the bot
      // genuinely has a working connection to Discord right now.
      client.rest.get("/users/@me"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("health check timed out")), HEALTH_CHECK_TIMEOUT_MS)
      ),
    ]);
    if (consecutiveFailures > 0) {
      console.log(`[bot] watchdog: connection recovered after ${consecutiveFailures} failed check(s).`);
    }
    consecutiveFailures = 0;
    console.log(`[bot] watchdog: health check ok at ${new Date().toISOString()}`);
  } catch (err) {
    consecutiveFailures++;
    console.warn(
      `[bot] watchdog: health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
      err instanceof Error ? err.message : err
    );
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(
        `[bot] watchdog: ${consecutiveFailures} consecutive failed health checks — connection is genuinely down. Exiting so Render restarts it.`
      );
      // Exit non-zero so Render's process manager treats this as a crash
      // and restarts the service. Do NOT try to client.destroy()/login()
      // again in-process first — a wedged discord.js client can fail to
      // clean up its old socket, so a fresh process is the reliable fix.
      process.exit(1);
    }
  }
}

function startWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;
  setInterval(activeHealthCheck, WATCHDOG_INTERVAL_MS);
}

client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);
  startWatchdog();
  startEventReminderJob(client);
  startWeeklySummaryJob(client);
});

client.on(guildMemberAdd.name, guildMemberAdd.execute);
client.on(guildMemberUpdate.name, guildMemberUpdate.execute);
client.on(messageReactionAdd.name, messageReactionAdd.execute);
client.on(messageReactionRemove.name, messageReactionRemove.execute);
client.on(messageCreate.name, messageCreate.execute);

client.on("shardDisconnect", (event, shardId) => {
  console.warn(`[bot] shard ${shardId} disconnected (code ${event?.code}). discord.js will try to reconnect.`);
});
client.on("shardReconnecting", (shardId) => {
  console.warn(`[bot] shard ${shardId} reconnecting…`);
});
client.on("shardResume", (shardId) => {
  console.log(`[bot] shard ${shardId} resumed.`);
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
