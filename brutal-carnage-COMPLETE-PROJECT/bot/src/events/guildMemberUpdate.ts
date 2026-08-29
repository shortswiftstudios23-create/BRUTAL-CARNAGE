// bot/src/events/guildMemberUpdate.ts
// Fires whenever a member's roles change. This is the heart of the
// Discord <-> website rank sync:
//
//   1. Diff old vs new roles to see if their mapped Rank changed.
//   2. Update the User.rank in the database to match.
//   3. If this is their FIRST ever rank role (i.e. they had no
//      passwordHash before), generate credentials, hash + store them,
//      and DM the plaintext to them once, privately.
//   4. If they already have an account, just sync the rank silently —
//      no repeat credential DMs on every subsequent promotion.

import { GuildMember, PartialGuildMember, Events, EmbedBuilder } from "discord.js";
import { prisma } from "../lib/prisma";
import { resolveHighestRank } from "../lib/roleMap";
import { generateTempPassword, generateUsername, hashPassword } from "../lib/credentials";
import { logAudit } from "../lib/audit";

export const name = Events.GuildMemberUpdate;

export function execute(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): void {
  handle(oldMember, newMember).catch((err) => {
    console.error(`[guildMemberUpdate] Failed processing role update for ${newMember.id}`, err);
  });
}

async function handle(
  oldMemberMaybePartial: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  try {
    // oldMember can arrive partial (missing cached role data) if it
    // wasn't in Discord.js's cache — fetch the full member so role
    // diffing below is reliable instead of comparing against an empty set.
    const oldMember = oldMemberMaybePartial.partial
      ? await oldMemberMaybePartial.fetch()
      : oldMemberMaybePartial;

    const oldRoleIds = [...oldMember.roles.cache.keys()];
    const newRoleIds = [...newMember.roles.cache.keys()];

    const oldRank = resolveHighestRank(oldRoleIds);
    const newRank = resolveHighestRank(newRoleIds);

    // No mapped rank role change at all — nothing to do.
    if (oldRank === newRank) return;
    if (!newRank) return; // they lost their only rank role; handle separately if desired

    const user = await prisma.user.findUnique({
      where: { discordId: newMember.id },
    });

    let resolvedUser = user;

    if (!resolvedUser) {
      // This shouldn't normally happen — guildMemberAdd should have
      // already provisioned the account when they joined. But if that
      // event was ever missed (e.g. the gateway connection was silently
      // dead for a few minutes around the time they joined), we'd
      // otherwise strand this member with a role and no account,
      // silently, forever. Self-heal by provisioning it here instead.
      console.warn(
        `[guildMemberUpdate] No website account for ${newMember.id} (${newMember.user.tag}) — guildMemberAdd was likely missed. Provisioning it now instead of skipping.`
      );
      resolvedUser = await prisma.user.create({
        data: {
          discordId: newMember.id,
          username: newMember.user.username,
          discordAvatar: newMember.user.displayAvatarURL(),
          rank: "NOOB",
        },
      });
      await logAudit(resolvedUser.id, "ACCOUNT_PROVISIONED_LATE_ON_ROLE_UPDATE");
    }

    const user2 = resolvedUser;
    const isFirstRankGrant = !user2.passwordHash;

    if (isFirstRankGrant) {
      const username = generateUsername(newMember.user.username);
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      await prisma.user.update({
        where: { id: user2.id },
        data: {
          rank: newRank,
          username,
          passwordHash,
          mustChangePassword: true,
        },
      });

      await sendCredentialsDM(newMember, username, tempPassword, newRank);
      await logAudit(user2.id, "CREDENTIALS_ISSUED", { rank: newRank });
    } else {
      await prisma.user.update({
        where: { id: user2.id },
        data: { rank: newRank },
      });

      await sendRankUpdateDM(newMember, newRank);
      await logAudit(user2.id, "RANK_SYNCED_FROM_DISCORD", { from: oldRank, to: newRank });
    }
  } catch (err) {
    // Re-thrown so execute()'s .catch() logs it consistently with other
    // event handlers, rather than duplicating error logging here.
    throw err;
  }
}

async function sendCredentialsDM(
  member: GuildMember,
  username: string,
  tempPassword: string,
  rank: string
) {
  const embed = new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle("Brutal Carnage — Website access granted")
    .setDescription(
      `You've been assigned the **${formatRank(rank)}** role and now have access to the family management system.`
    )
    .addFields(
      { name: "Website", value: process.env.WEBSITE_URL ?? "https://brutalcarnage.example.com", inline: false },
      { name: "Username", value: `\`${username}\``, inline: true },
      { name: "Temporary password", value: `\`${tempPassword}\``, inline: true },
      { name: "Important", value: "You'll be asked to set a new password on first login. Do not share these credentials with anyone." }
    )
    .setFooter({ text: "This message was sent privately and will not be repeated." });

  try {
    await member.send({ embeds: [embed] });
  } catch {
    // DMs closed — fall back to a note the admins can see rather than
    // silently failing. Never post credentials in a public channel.
    console.warn(`[guildMemberUpdate] Could not DM credentials to ${member.id} — DMs likely closed.`);
    const fallbackChannel = member.guild.systemChannel;
    if (fallbackChannel) {
      await fallbackChannel.send({
        content: `<@${member.id}> I couldn't DM you your website credentials — please open your DMs and ask a Deputy+ to have the bot resend them, or contact an admin directly.`,
      });
    }
  }
}

async function sendRankUpdateDM(member: GuildMember, rank: string) {
  const embed = new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle("Brutal Carnage — Rank updated")
    .setDescription(`Your family rank has been synced to **${formatRank(rank)}**. Your website permissions now reflect this.`);

  try {
    await member.send({ embeds: [embed] });
  } catch {
    // Non-critical for repeat updates — fail silently.
  }
}

function formatRank(rank: string): string {
  return rank
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
