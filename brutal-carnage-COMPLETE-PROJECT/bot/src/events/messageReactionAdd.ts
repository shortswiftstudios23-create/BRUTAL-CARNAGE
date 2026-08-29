// bot/src/events/messageReactionAdd.ts
// This is the fix for "people react on Discord but the registration
// doesn't show on the website" — nothing was ever listening for the
// reaction before. Now: react ✅ on an event's announcement message and
// it creates the exact same EventRegistration row the website's
// "Register" button does, so reminders (which tag from
// EventRegistration) and the website's attendee list both pick it up
// immediately.

import { Events, MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";

export const name = Events.MessageReactionAdd;

const REGISTER_EMOJI = "✅";

export async function execute(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  try {
    if (user.bot) return; // ignore the bot's own seeded reaction
    if (reaction.emoji.name !== REGISTER_EMOJI) return;

    // Partial reactions/messages (e.g. after a bot restart, or an old
    // message not in cache) need to be fetched before their data is usable.
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error("[messageReactionAdd] failed to fetch partial reaction", err);
        return;
      }
    }

    const event = await prisma.event.findFirst({
      where: { discordMessageId: reaction.message.id },
    });
    if (!event) return; // reaction on some other message — not ours

    if (event.status === "COMPLETED" || event.status === "CANCELLED") return;

    const member = await prisma.user.findUnique({ where: { discordId: user.id } });
    if (!member) {
      console.warn(`[messageReactionAdd] reaction from unknown Discord user ${user.id} — no linked account`);
      return;
    }

    await prisma.eventRegistration.upsert({
      where: { eventId_userId: { eventId: event.id, userId: member.id } },
      update: {},
      create: { eventId: event.id, userId: member.id },
    });

    await prisma.notification.create({
      data: {
        userId: member.id,
        type: "EVENT",
        title: "Registered via Discord reaction",
        body: `You're registered for "${event.title}". Unreact or use the website to cancel.`,
      },
    });

    await logAudit(member.id, "EVENT_REGISTERED_VIA_REACTION", { eventId: event.id });
    console.log(`[messageReactionAdd] ${member.username} registered for "${event.title}" via reaction`);
  } catch (err) {
    console.error("[messageReactionAdd] failed to process reaction", err);
  }
}
