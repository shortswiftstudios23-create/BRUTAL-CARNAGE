// bot/src/events/messageReactionRemove.ts
// Mirror of messageReactionAdd.ts — un-reacting cancels the registration,
// matching the website's register button which also toggles.

import { Events, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";

export const name = Events.MessageReactionRemove;

const REGISTER_EMOJI = "✅";

export async function execute(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  try {
    if (user.bot) return;
    if (reaction.emoji.name !== REGISTER_EMOJI) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error("[messageReactionRemove] failed to fetch partial reaction", err);
        return;
      }
    }

    const event = await prisma.event.findFirst({
      where: { discordMessageId: reaction.message.id },
    });
    if (!event) return;

    const member = await prisma.user.findUnique({ where: { discordId: user.id } });
    if (!member) return;

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: member.id } },
    });
    if (!existing) return;

    await prisma.eventRegistration.delete({ where: { id: existing.id } });

    await logAudit(member.id, "EVENT_UNREGISTERED_VIA_REACTION", { eventId: event.id });
    console.log(`[messageReactionRemove] ${member.username} unregistered from "${event.title}"`);
  } catch (err) {
    console.error("[messageReactionRemove] failed to process reaction removal", err);
  }
}
