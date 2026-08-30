// lib/validators/members.ts
import { z } from "zod";
import { Rank } from "@prisma/client";

// Admin manual-create-member flow. Username/rank are the only required
// admin inputs — password is always generated server-side (see
// lib/credentials.ts) so a plaintext password never travels through a
// form the admin fills in and could screenshot/leak.
export const createMemberSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  rank: z.nativeEnum(Rank).default("NOOB"),
  gameId: z.string().max(32).optional(),
});

// Self-service account settings: change username and/or password.
// currentPassword is always required to change either — this is a
// confirmation step, not a re-auth of the whole session.
export const updateAccountSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newUsername: z
      .string()
      .min(3)
      .max(24)
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only")
      .optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
  })
  .refine((data) => data.newUsername || data.newPassword, {
    message: "Provide a new username and/or a new password",
  });
