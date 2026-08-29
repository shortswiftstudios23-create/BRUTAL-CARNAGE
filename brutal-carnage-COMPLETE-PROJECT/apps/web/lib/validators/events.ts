// lib/validators/events.ts
import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(2000),
  startsAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "Start time must be in the future",
  }),
  location: z.string().max(120).optional(),
  isGiveaway: z.boolean().default(false),
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
