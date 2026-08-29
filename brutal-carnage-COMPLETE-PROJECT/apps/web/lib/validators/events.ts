// lib/validators/events.ts
import { z } from "zod";
import { EVENT_TYPES } from "../eventChannelMap";

export const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(2000),
  startsAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "Start time must be in the future",
  }),
  location: z.string().max(120).optional(),
  isGiveaway: z.boolean().default(false),
  // Which event this is — used to tag the right proof-submission channel.
  eventType: z.enum(EVENT_TYPES).optional(),
  // Optional bonus set up-front at creation time, paid out to attendees
  // only if the event is later marked a WIN.
  bonusAmount: z.coerce.number().nonnegative().optional(),
});

// Editing an existing event. Managers can update any of these; startsAt
// is still required to be in the future so an edit can't be used to
// "un-expire" an event that already happened.
export const updateEventSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(3).max(2000).optional(),
  startsAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), { message: "Start time must be in the future" })
    .optional(),
  location: z.string().max(120).optional(),
  isGiveaway: z.boolean().optional(),
  eventType: z.enum(EVENT_TYPES).optional(),
  bonusAmount: z.coerce.number().nonnegative().optional(),
});

// Marking a completed event: result, optional per-attendee bonus, optional MVP.
// Bonuses only ever apply on WIN — enforced again server-side, not just here.
export const completeEventSchema = z
  .object({
    result: z.enum(["WIN", "LOSS"]),
    bonusAmount: z.coerce.number().nonnegative().optional(),
    mvpUserId: z.string().cuid().optional(),
    mvpBonusAmount: z.coerce.number().nonnegative().optional(),
    attendedUserIds: z.array(z.string().cuid()).default([]),
  })
  .refine((d) => d.result === "WIN" || (!d.bonusAmount && !d.mvpBonusAmount), {
    message: "Bonuses can only be awarded on a Win",
    path: ["bonusAmount"],
  })
  .refine((d) => !d.mvpBonusAmount || (d.mvpUserId && d.attendedUserIds.includes(d.mvpUserId)), {
    message: "MVP must be one of the marked attendees",
    path: ["mvpUserId"],
  });
