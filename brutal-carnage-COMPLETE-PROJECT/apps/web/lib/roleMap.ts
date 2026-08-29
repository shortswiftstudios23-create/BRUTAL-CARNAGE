// apps/web/lib/roleMap.ts
// Web-side copy of bot/src/lib/roleMap.ts. This MUST stay in sync with
// that file — same role IDs, same rank mapping.
//
// Why a duplicate instead of importing across packages: Vercel builds
// apps/web with its Root Directory set to apps/web, so anything outside
// that folder (like ../../bot) does not exist at build time and the
// build fails with "Module not found". Since this is two small plain
// TypeScript objects, duplicating is simpler and more reliable here
// than setting up a shared workspace package for a two-file monorepo.
//
// IMPORTANT: If you change role IDs in bot/src/lib/roleMap.ts, copy the
// same change here too.

import { Rank } from "@prisma/client";

export const ROLE_TO_RANK: Record<string, Rank> = {
  "1542487055844515847": "NOOB",
  "1542487055844515848": "ROOKIE",
  "1542487055844515849": "CADET",
  "1542487055886716968": "TURFER",
  "1542487055886716970": "EVENT_MANAGER",
  "1542487055886716969": "BUSINESS_MANAGER",
  "1542487055886716971": "UNDER_DEPUTY",
  "1542487055886716972": "DEPUTY",
  "1542487055886716973": "BOSS",
  "1542487055886716974": "BIG_BOSS",
};

export const RANK_TO_ROLE: Record<Rank, string> = Object.fromEntries(
  Object.entries(ROLE_TO_RANK).map(([roleId, rank]) => [rank, roleId])
) as Record<Rank, string>;
