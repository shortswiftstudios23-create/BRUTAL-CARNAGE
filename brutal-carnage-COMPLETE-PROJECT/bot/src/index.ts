// bot/src/index.ts
// Entry point. Run with `pm2 start dist/index.js --name brutal-carnage-bot`
// on the always-on VM (see the connection guide for full setup).

import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as guildMemberAdd from "./events/guildMemberAdd";
import * as guildMemberUpdate from "./events/guildMemberUpdate";
import { startEventReminderJob } from "./jobs/eventReminder";
import { startWeeklySummaryJob } from "./jobs/weeklySummary";

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
