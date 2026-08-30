// lib/validators/discipline.ts
import { z } from "zod";

export const createPromotionRequestSchema = z.object({
  toRank: z.enum([
    "ROOKIE", "CADET", "TURFER", "EVENT_MANAGER", "BUSINESS_MANAGER",
    "UNDER_DEPUTY", "DEPUTY", "BOSS", "BIG_BOSS",
  ]),
  // Why you think you deserve the promotion — required so every request
  // (website or Discord) always has a reason attached, matching the
  // fixed Name/ID/Prev Rank/Requested Rank/Reason template used on both.
  reason: z.string().min(5, "Give a reason (at least 5 characters).").max(500),
});

export const reviewPromotionRequestSchema = z.object({
  rejectionNote: z.string().max(300).optional(),
});

export const createStrikeSchema = z.object({
  userId: z.string().cuid(),
  severity: z.enum(["MINOR", "MAJOR", "SEVERE"]),
  reason: z.string().min(5).max(500),
});

export const createReportSchema = z.object({
  reportedUserId: z.string().cuid(),
  statement: z.string().min(20, "Give a detailed written statement — at least 20 characters.").max(3000),
  videoProofUrl: z.string().url("A video proof link is required."),
});

export const reviewReportSchema = z.object({
  approve: z.boolean(), // approve = substantiated, reject = dismissed
  resolutionNote: z.string().max(500).optional(),
});

export const setBlacklistSchema = z.object({
  blacklisted: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const createPrivateNoteSchema = z.object({
  content: z.string().min(3).max(2000),
});
