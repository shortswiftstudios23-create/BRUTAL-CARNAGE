// bot/src/events/guildMemberAdd.ts
// Fires the instant someone joins the Brutal Carnage Discord server.
// Creates their website account immediately at NOOB rank, with no
// password yet — a password is only issued once they're granted an
// actual rank role (see guildMemberUpdate.ts). This avoids handing out
// credentials to accounts that might leave before ever being vetted.

import { GuildMember, Events } from "discord.js";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember) {
  try {
    const existing = await prisma.user.findUnique({
      where: { discordId: member.id },
    });

    if (existing) {
      // Rejoining member — don't duplicate, just note it.
      await logAudit(existing.id, "MEMBER_REJOINED_DISCORD");
      return;
    }

    const user = await prisma.user.create({
      data: {
        discordId: member.id,
        username: member.user.username,
        discordAvatar: member.user.displayAvatarURL(),
        rank: "NOOB",
        // no passwordHash yet — set on first role grant
      },
    });

    await logAudit(user.id, "ACCOUNT_PROVISIONED_ON_JOIN");
    console.log(`[guildMemberAdd] Provisioned account for ${member.user.tag} (${member.id})`);
  } catch (err) {
    console.error(`[guildMemberAdd] Failed to provision account for ${member.id}`, err);
  }
}
