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

client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);
  startEventReminderJob(client);
  startWeeklySummaryJob(client);
});

client.on(guildMemberAdd.name, guildMemberAdd.execute);
client.on(guildMemberUpdate.name, guildMemberUpdate.execute);

client.on("error", (err) => console.error("[bot] Client error:", err));
process.on("unhandledRejection", (err) => console.error("[bot] Unhandled rejection:", err));

client.login(process.env.DISCORD_BOT_TOKEN);
